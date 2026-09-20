import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { q } from '../../db.js';
import { config } from '../../config.js';
import { BadRequest, NotFound } from '../error.js';
import { resolvePair, readLastIndexedHeight } from '../repos/pairs.js';
import { loadUsdTable, type UsdTable } from '../repos/usd.js';
import { queryBool } from '../query.js';
import { KIND_LABEL } from '../pairShape.js';

const Query = z.object({
  kind: z.enum(['Trade', 'lp']).default('Trade'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  // Cursor mode (newest-first "load older"). Mutually exclusive with `offset`.
  before: z.coerce.number().int().positive().optional(),
  // Row id (trade_id / event_id) of the last row seen, paired with `before`.
  // Several trades share one block timestamp, so `before` alone would skip
  // the rest of the block the previous page ended in.
  before_id: z.coerce.number().int().positive().optional(),
  // Offset mode (numbered pagination). When present, takes precedence over
  // `before`. `count=true` additionally returns the pool's total row count so
  // the UI can render "Showing X to Y of N entries".
  offset: z.coerce.number().int().min(0).optional(),
  count: queryBool(false),
  include_unconfirmed: queryBool(true),
});

interface TradeRow {
  trade_id: string;
  height: string;
  block_ts: Date;
  aid_in: string;
  aid_out: string;
  amount_in: string;
  amount_out: string;
  volume_aid1: string | null;
  volume_aid2: string | null;
  price_native: string | null;
  confirmed: boolean;
  aid1: string;
  decimals1: number;
}

// Columns every trade tape row carries; the global route adds pool identity.
const TRADE_COLUMNS = `t.trade_id::text, t.height::text, t.block_ts,
                  t.aid_in::text, t.aid_out::text,
                  t.amount_in::text, t.amount_out::text,
                  t.volume_aid1::text, t.volume_aid2::text,
                  t.price_native::text,
                  t.confirmed,
                  p.aid1::text, a1.decimals AS decimals1`;

// Wire shape shared by /pairs/{id}/trades and /trades. The base (aid1) is
// priced off the shared USD table, so non-BEAM-quoted pools carry USD figures
// whenever their base is reachable through some BEAM-quoted pool.
function toTradeJson(r: TradeRow, usd: UsdTable, lastHeight: number) {
  const aid1 = Number(r.aid1);
  const aidIn = Number(r.aid_in);
  const priceNative = r.price_native ? Number(r.price_native) : null;
  // buy = the base (aid1) was acquired, i.e. the target (aid2) was paid in.
  // Per the AMM Trade primitive (m_Buy1 = buy aid1), aid_in == aid1 means the
  // user paid the base → sell.
  const side: 'buy' | 'sell' = aidIn === aid1 ? 'sell' : 'buy';
  const volumeAid1Human = r.volume_aid1
    ? Number(r.volume_aid1) / 10 ** r.decimals1
    : null;
  const usdPerBase = usd.perAid.get(aid1) ?? null;
  const priceUsd =
    usdPerBase !== null && priceNative !== null && priceNative > 0
      ? usdPerBase / priceNative
      : null;
  const valueUsd =
    usdPerBase !== null && volumeAid1Human !== null
      ? +(volumeAid1Human * usdPerBase).toFixed(4)
      : null;
  return {
    trade_id: Number(r.trade_id),
    timestamp: Math.floor(r.block_ts.getTime() / 1000),
    height: Number(r.height),
    aid_in: aidIn,
    aid_out: Number(r.aid_out),
    amount_in: r.amount_in,
    amount_out: r.amount_out,
    side,
    price_native: priceNative,
    price_usd: priceUsd,
    value_usd: valueUsd,
    confirmed: r.confirmed,
    confirmations: r.confirmed
      ? config.CONFIRMATIONS
      : Math.max(0, lastHeight - Number(r.height)),
  };
}

interface LpRow {
  event_id: string;
  height: string;
  block_ts: Date;
  kind: 'Deposit' | 'Withdraw';
  amount1: string;
  amount2: string;
  amount_ctl: string;
  confirmed: boolean;
  ctl_after: string | null;
}

export async function tradesRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>('/pairs/:id/trades', async (req, reply) => {
    const resolved = await resolvePair(req.params.id);
    if (resolved === null) throw NotFound('PAIR_NOT_FOUND', `no pair ${req.params.id}`);
    // Combined (pair-form) ids fan out across every tier; single-tier ids
    // resolve to a one-element array, preserving the per-pool behaviour.
    const poolIds = resolved.poolIds;

    const parsed = Query.safeParse(req.query);
    if (!parsed.success) {
      throw BadRequest('BAD_REQUEST', parsed.error.issues[0]?.message ?? 'invalid query');
    }
    const {
      kind, limit, before, before_id, offset, count, include_unconfirmed,
    } = parsed.data;

    const useOffset = offset !== undefined;
    const beforeTs = before ? new Date(before * 1000) : new Date();
    const confirmedFilter = include_unconfirmed ? '' : 'AND t.confirmed = TRUE';
    // Pagination fragments after `$1` (the pool ids). Offset mode binds
    // limit/offset; cursor mode binds the keyset `(block_ts, id) < (ts, id)`
    // when the caller passed both halves, plain `block_ts < ts` otherwise.
    const paging = (idCol: string): { where: string; tail: string; params: Array<Date | number> } => {
      if (useOffset) return { where: '', tail: 'LIMIT $2 OFFSET $3', params: [limit, offset] };
      const keyset = before !== undefined && before_id !== undefined;
      return {
        where: keyset ? `AND (t.block_ts, t.${idCol}) < ($2, $3)` : 'AND t.block_ts < $2',
        tail: `LIMIT $${keyset ? 4 : 3}`,
        params: keyset ? [beforeTs, before_id, limit] : [beforeTs, limit],
      };
    };

    if (kind === 'lp') {
      // ctl_after: LP token supply at the first snapshot taken at/after the
      // event's height — i.e. the pool size *after* this deposit/withdraw.
      // liquidity_pct expresses the event as a (signed) share of the pool it
      // moved: the supply after a deposit, before a withdraw. Dividing a
      // near-total withdraw by the dust it leaves behind yields nonsense.
      const ctlAfterCol = `(SELECT s.ctl_supply::text FROM pool_state_snapshots s
                              WHERE s.pool_id = t.pool_id AND s.height >= t.height
                              ORDER BY s.height LIMIT 1) AS ctl_after`;
      const page = paging('event_id');
      const [{ rows }, total] = await Promise.all([
        q<LpRow>(
          `SELECT event_id::text, height::text, block_ts, kind,
                  amount1::text, amount2::text, amount_ctl::text, confirmed,
                  ${ctlAfterCol}
             FROM lp_events t
            WHERE t.pool_id = ANY($1)
              ${page.where}
              ${confirmedFilter}
            ORDER BY t.block_ts DESC, t.event_id DESC
            ${page.tail}`,
          [poolIds, ...page.params],
        ),
        count ? countRows('lp_events', poolIds, include_unconfirmed) : null,
      ]);
      const trades = rows.map((r) => {
        const ctlAfter = r.ctl_after ? Number(r.ctl_after) : null;
        const amtCtl = Number(r.amount_ctl);
        const base = r.kind === 'Withdraw' ? (ctlAfter ?? 0) + amtCtl : ctlAfter;
        const share = base && base > 0
          ? Math.min((amtCtl / base) * 100, 100)
          : null;
        const liquidityPct = share === null
          ? null
          : r.kind === 'Withdraw' ? -share : share;
        return {
          event_id: Number(r.event_id),
          timestamp: Math.floor(r.block_ts.getTime() / 1000),
          height: Number(r.height),
          kind: r.kind,
          amount1: r.amount1,
          amount2: r.amount2,
          amount_ctl: r.amount_ctl,
          liquidity_pct: liquidityPct,
          confirmed: r.confirmed,
        };
      });
      void reply.header('cache-control', 'public, max-age=15');
      return {
        trades,
        before: useOffset ? null : trades.at(-1)?.timestamp ?? null,
        before_id: useOffset ? null : trades.at(-1)?.event_id ?? null,
        offset: useOffset ? offset : null,
        limit,
        total,
      };
    }

    const page = paging('trade_id');
    const [lastHeight, usd, total, { rows }] = await Promise.all([
      readLastIndexedHeight(),
      loadUsdTable(),
      count ? countRows('trades', poolIds, include_unconfirmed) : null,
      q<TradeRow>(
        `SELECT ${TRADE_COLUMNS}
           FROM trades t
           JOIN pools p   ON p.pool_id = t.pool_id
           JOIN assets a1 ON a1.aid    = p.aid1
          WHERE t.pool_id = ANY($1)
            ${page.where}
            ${confirmedFilter}
          ORDER BY t.block_ts DESC, t.trade_id DESC
          ${page.tail}`,
        [poolIds, ...page.params],
      ),
    ]);

    const trades = rows.map((r) => toTradeJson(r, usd, lastHeight));

    void reply.header('cache-control', 'public, max-age=15');
    return {
      trades,
      before: useOffset ? null : trades.at(-1)?.timestamp ?? null,
      before_id: useOffset ? null : trades.at(-1)?.trade_id ?? null,
      offset: useOffset ? offset : null,
      limit,
      total,
    };
  });
}

// Total row count for a pool, honouring the unconfirmed filter so the
// "of N entries" denominator matches the rows actually paged through.
async function countRows(
  table: 'trades' | 'lp_events',
  poolIds: number[],
  includeUnconfirmed: boolean,
): Promise<number> {
  const filter = includeUnconfirmed ? '' : 'AND confirmed = TRUE';
  const { rows } = await q<{ n: string }>(
    `SELECT count(*)::text AS n FROM ${table} WHERE pool_id = ANY($1) ${filter}`,
    [poolIds],
  );
  return rows[0] ? Number(rows[0].n) : 0;
}

// ---------------------------------------------------------------------------
// GET /api/trades — DEX-wide trade tape, newest first.
//
// Same per-trade shape as /api/pairs/{id}/trades plus the pool identity fields
// a consumer needs when rows arrive from many pools at once. Cursor-only
// pagination (`before`): with no pool filter there is no stable offset to page
// against while the indexer keeps writing to the head of the feed.
// ---------------------------------------------------------------------------

const GlobalQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  before: z.coerce.number().int().positive().optional(),
  before_id: z.coerce.number().int().positive().optional(),
  include_unconfirmed: queryBool(true),
  include_imposters: queryBool(false),
  kind: z.coerce.number().int().min(0).max(2).optional(),
  aid: z.coerce.number().int().min(0).optional(),
});

interface GlobalTradeRow extends TradeRow {
  pool_id: string;
  aid2: string;
  kind: number;
  symbol1: string | null;
  symbol2: string | null;
}

export async function globalTradesRoutes(app: FastifyInstance): Promise<void> {
  app.get('/trades', async (req, reply) => {
    const parsed = GlobalQuery.safeParse(req.query);
    if (!parsed.success) {
      throw BadRequest('BAD_REQUEST', parsed.error.issues[0]?.message ?? 'invalid query');
    }
    const { limit, before, before_id, include_unconfirmed, include_imposters, kind, aid } = parsed.data;

    const beforeTs = before ? new Date(before * 1000) : new Date();
    const where: string[] = ['p.destroyed_at_height IS NULL'];
    const params: (Date | number | boolean)[] = [beforeTs];
    // Keyset cursor (see the per-pair route): both halves resume exactly after
    // the last row seen; `before` alone stays a plain timestamp bound.
    if (before !== undefined && before_id !== undefined) {
      params.push(before_id);
      where.push('(t.block_ts, t.trade_id) < ($1, $2)');
    } else {
      where.push('t.block_ts < $1');
    }

    if (!include_unconfirmed) where.push('t.confirmed = TRUE');
    if (!include_imposters) where.push('a1.is_imposter = FALSE', 'a2.is_imposter = FALSE');
    if (kind !== undefined) {
      params.push(kind);
      where.push(`p.kind = $${params.length}`);
    }
    if (aid !== undefined) {
      params.push(aid);
      where.push(`(p.aid1 = $${params.length} OR p.aid2 = $${params.length})`);
    }
    params.push(limit);

    const [lastHeight, usd, { rows }] = await Promise.all([
      readLastIndexedHeight(),
      loadUsdTable(),
      q<GlobalTradeRow>(
        `SELECT ${TRADE_COLUMNS},
                p.pool_id::text, p.aid2::text, p.kind,
                a1.short_name AS symbol1, a2.short_name AS symbol2
           FROM trades t
           JOIN pools p   ON p.pool_id = t.pool_id
           JOIN assets a1 ON a1.aid    = p.aid1
           JOIN assets a2 ON a2.aid    = p.aid2
          WHERE ${where.join(' AND ')}
          ORDER BY t.block_ts DESC, t.trade_id DESC
          LIMIT $${params.length}`,
        params,
      ),
    ]);

    const trades = rows.map((r) => {
      const { trade_id, ...rest } = toTradeJson(r, usd, lastHeight);
      return {
        trade_id,
        pool_id: Number(r.pool_id),
        pair_id: Number(r.pool_id),
        aid1: Number(r.aid1),
        aid2: Number(r.aid2),
        symbol1: r.symbol1,
        symbol2: r.symbol2,
        kind: r.kind,
        kind_label: KIND_LABEL[r.kind] ?? 'Unknown',
        ...rest,
      };
    });

    void reply.header('cache-control', 'public, max-age=15');
    return {
      trades,
      before: trades.at(-1)?.timestamp ?? null,
      before_id: trades.at(-1)?.trade_id ?? null,
      limit,
    };
  });
}
