import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { queryBool } from '../query.js';
import { BadRequest, NotFound } from '../error.js';
import {
  countPairs, listPairs, readLastIndexedHeight, resolvePair, type SortKey,
} from '../repos/pairs.js';
import { loadUsdTable } from '../repos/usd.js';
import { loadSparklines7d } from '../repos/sparklines.js';
import { toResponse, type ResponsePair } from '../pairShape.js';

function bigintSumStr(values: Array<string | null>): string {
  let acc = 0n;
  for (const v of values) if (v) acc += BigInt(v);
  return acc.toString();
}

function numSum(values: Array<number | null>): number | null {
  let acc = 0;
  let any = false;
  for (const v of values) if (v !== null) { acc += v; any = true; }
  return any ? +acc.toFixed(2) : null;
}

/** Collapse the per-tier ResponsePairs of each (aid1, aid2) pair into one
 *  combined row: reserves/volume/txns are summed across tiers, while price and
 *  identity come from the reference (deepest reserve1) tier — matching the
 *  USD-valuation convention in repos/usd.ts. */
function groupByPair(pairs: ResponsePair[]): ResponsePair[] {
  const groups = new Map<string, ResponsePair[]>();
  for (const p of pairs) {
    const key = `${p.aid1}-${p.aid2}`;
    const g = groups.get(key);
    if (g) g.push(p); else groups.set(key, [p]);
  }

  const out: ResponsePair[] = [];
  for (const tiers of groups.values()) {
    // Reference tier = deepest by reserve1 groths (comparable across tiers of
    // the same pair, which share aid1/aid2).
    const ref = tiers.reduce((a, b) =>
      (BigInt(b.reserve1 ?? '0') > BigInt(a.reserve1 ?? '0') ? b : a));

    out.push({
      ...ref,
      reserve1: bigintSumStr(tiers.map((t) => t.reserve1)),
      reserve2: bigintSumStr(tiers.map((t) => t.reserve2)),
      reserve1_human: numSum(tiers.map((t) => t.reserve1_human)),
      reserve2_human: numSum(tiers.map((t) => t.reserve2_human)),
      reserve1_usd: numSum(tiers.map((t) => t.reserve1_usd)),
      reserve2_usd: numSum(tiers.map((t) => t.reserve2_usd)),
      tvl_usd: numSum(tiers.map((t) => t.tvl_usd)),
      volume_24h_groth: bigintSumStr(tiers.map((t) => t.volume_24h_groth)),
      volume_24h_usd: numSum(tiers.map((t) => t.volume_24h_usd)),
      buys_24h: tiers.reduce((s, t) => s + t.buys_24h, 0),
      sells_24h: tiers.reduce((s, t) => s + t.sells_24h, 0),
      trades_24h: tiers.reduce((s, t) => s + t.trades_24h, 0),
      tiers: tiers
        .slice()
        .sort((a, b) => (BigInt(b.reserve1 ?? '0') > BigInt(a.reserve1 ?? '0') ? 1 : -1))
        .map((t) => ({
          pool_id: t.pair_id,
          kind: t.kind,
          kind_label: t.kind_label,
          lp_token: t.lp_token,
          tvl_usd: t.tvl_usd,
          volume_24h_usd: t.volume_24h_usd,
          reserve1_human: t.reserve1_human,
          reserve2_human: t.reserve2_human,
          price_native: t.price_native,
        })),
    });
  }
  return out;
}

function sortValue(p: ResponsePair, key: SortKey): number {
  switch (key) {
    case 'tvl_usd': return p.tvl_usd ?? -Infinity;
    case 'volume_24h_usd': return p.volume_24h_usd ?? -Infinity;
    case 'price_change_24h': return p.price_change_24h ?? -Infinity;
    case 'trades_24h': return p.trades_24h;
    case 'aid2': return p.aid2;
    default: return -Infinity;
  }
}

const ListQuery = z.object({
  sort_by: z
    .enum(['tvl_usd', 'volume_24h_usd', 'price_change_24h', 'trades_24h', 'aid2'])
    .default('tvl_usd'),
  order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().nonnegative().default(0),
  search: z.string().optional(),
  kind: z.coerce.number().int().min(0).max(2).optional(),
  include_imposters: queryBool(false),
  // 'pair' collapses fee tiers into one combined row per (aid1, aid2).
  group: z.enum(['tier', 'pair']).default('tier'),
});

export async function pairsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/pairs', async (req, reply) => {
    const parsed = ListQuery.safeParse(req.query);
    if (!parsed.success) {
      throw BadRequest('BAD_REQUEST', parsed.error.issues[0]?.message ?? 'invalid query');
    }
    const opts = parsed.data;

    // App-side sort/slice is required when:
    //  - sorting by a USD figure (`tvl_usd`/`volume_24h_usd`): the USD-per-AID
    //    rates come from the multi-hop helper, not SQL — otherwise a tiny
    //    TICO/Nph pool (huge raw-groth reserves, ~$37 USD) ranks above
    //    BEAM/BeamX ($27k USD).
    //  - grouping by pair: tiers are collapsed in JS, so any sort/slice must
    //    happen after the merge.
    const grouped = opts.group === 'pair';
    const needsAppSort = grouped
      || opts.sort_by === 'volume_24h_usd' || opts.sort_by === 'tvl_usd';

    const filters = {
      ...(opts.search !== undefined ? { search: opts.search } : {}),
      ...(opts.kind !== undefined ? { kind: opts.kind as 0 | 1 | 2 } : {}),
      include_imposters: opts.include_imposters,
    };
    const [usd, lastHeight, rows, sqlTotal] = await Promise.all([
      loadUsdTable(),
      readLastIndexedHeight(),
      listPairs({
        // For SQL-side sort we pass the user's choice; otherwise pull a
        // default-ordered window wide enough to cover any reasonable offset.
        sort_by: (needsAppSort ? 'aid2' : opts.sort_by) as SortKey,
        order: needsAppSort ? 'asc' : opts.order,
        limit: needsAppSort ? 500 : opts.limit,
        offset: needsAppSort ? 0 : opts.offset,
        ...filters,
      }),
      // SQL-side paging returns one page, so the match count needs its own
      // query. The app-sort path already holds the whole (≤500-row) set.
      needsAppSort ? null : countPairs(filters),
    ]);

    let pairs = rows.map((r) => toResponse(r, usd));
    if (grouped) pairs = groupByPair(pairs);

    const total = sqlTotal ?? pairs.length;

    if (needsAppSort) {
      const sign = opts.order === 'asc' ? 1 : -1;
      pairs.sort((a, b) => (sortValue(a, opts.sort_by) - sortValue(b, opts.sort_by)) * sign);
      pairs = pairs.slice(opts.offset, opts.offset + opts.limit);
    }

    // Backfill sparkline_7d only for the final visible page (post-sort/slice)
    // to avoid loading 4h candles for the 500-row super-set used in app-sort.
    // pair_id is the reference (deepest) pool for grouped rows.
    const sparklines = await loadSparklines7d(pairs.map((p) => p.pair_id));
    pairs = pairs.map((p) => ({ ...p, sparkline_7d: sparklines.get(p.pair_id) ?? [] }));

    void reply.header('cache-control', 'public, max-age=15');
    return { pairs, total, last_indexed_height: lastHeight };
  });

  app.get<{ Params: { id: string } }>('/pairs/:id', async (req, reply) => {
    const resolved = await resolvePair(req.params.id);
    if (resolved === null) {
      throw NotFound('PAIR_NOT_FOUND', `no pair matching ${req.params.id}`);
    }
    const mine = await listPairs({
      sort_by: 'aid2',
      order: 'asc',
      limit: 500,
      offset: 0,
      include_imposters: true,
      poolIds: resolved.poolIds,
    });
    if (mine.length === 0) throw NotFound('PAIR_NOT_FOUND', `pool ${resolved.refPoolId} not found`);

    const [usd, sparklines] = await Promise.all([
      loadUsdTable(),
      loadSparklines7d([resolved.refPoolId]),
    ]);
    const mapped = mine.map((r) => toResponse(r, usd));
    // Combined (multi-tier) reference → grouped row; single tier → that row.
    const result = resolved.poolIds.length > 1
      ? groupByPair(mapped)[0]!
      : mapped.find((p) => p.pair_id === resolved.refPoolId) ?? mapped[0]!;
    result.sparkline_7d = sparklines.get(resolved.refPoolId) ?? [];

    void reply.header('cache-control', 'public, max-age=15');
    return result;
  });
}
