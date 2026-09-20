import { q } from '../../db.js';

/**
 * Present-time USD valuation built off the BEAM oracle median + on-chain pool
 * reserves.
 *
 * Strategy: for each non-BEAM asset, find the **deepest BEAM-quoted pool**
 * (pool where aid1=0=BEAM is paired with that asset) and derive
 *
 *     usd_per_whole_unit = beam_usd × (BEAM-per-aid rate from that pool)
 *
 * "Deepest" = highest BEAM reserve (reserve1, since BEAM is canonical aid1 < other).
 * BEAM/USD is the most recent oracle snapshot.
 *
 * Two tables share that rule and differ in one policy:
 *  - `loadUsdTable` (stats, pairs, trades, /cg, og) prices through live pools
 *    only and omits assets without a USD path.
 *  - `getLatestUsdPrices` (DAO treasury/revenue) covers the whole asset catalog
 *    and keeps destroyed pools: their final reserves still price an asset the
 *    DAO holds after its only pool was closed.
 *
 * Both are cached across requests for a short TTL: the underlying data only
 * changes when the indexer ticks (30s), and every consuming route already
 * declares `max-age=15` or more, so concurrent pollers share one computation.
 */
export interface UsdTable {
  beam_usd: number | null;
  /** USD value of 1 *whole unit* (post-decimals) of the given AID. */
  perAid: Map<number, number>;
}

export interface AssetPrice {
  aid: number;
  decimals: number;
  symbol: string;
  /** USD per 1 whole unit of the asset; null when the asset has no BEAM pool. */
  usdPerUnit: number | null;
}

interface DeepestPoolRow {
  aid_other: string;       // the non-BEAM aid
  beam_reserve: string;    // BEAM groths in the pool (aid1=0)
  other_reserve: string;   // groths of aid_other (aid2)
  other_decimals: number;
}

interface OracleRow {
  beam_usd: string;
}

// TTL sits inside the weakest declared client tolerance (max-age=15). Caching
// the promise (not the value) also collapses concurrent cache-miss callers
// into a single pair of queries. A failure is never cached — the next caller
// retries immediately.
const USD_TTL_MS = 10_000;
function memo<T>(fetch: () => Promise<T>): () => Promise<T> {
  let cached: { at: number; promise: Promise<T> } | null = null;
  return async () => {
    if (cached && Date.now() - cached.at < USD_TTL_MS) return cached.promise;
    const entry = { at: Date.now(), promise: fetch() };
    cached = entry;
    try {
      return await entry.promise;
    } catch (err) {
      if (cached === entry) cached = null;
      throw err;
    }
  };
}

export const loadUsdTable: () => Promise<UsdTable> = memo(fetchUsdTable);

/** Latest USD price per catalogued asset, keyed by aid. */
export const getLatestUsdPrices: () => Promise<Map<number, AssetPrice>> = memo(fetchAssetPrices);

/** Latest oracle BEAM/USD row, uncached. */
export async function readBeamUsd(): Promise<number | null> {
  const { rows } = await q<OracleRow>(
    'SELECT beam_usd::text FROM oracle_snapshots ORDER BY ts DESC LIMIT 1',
  );
  return rows[0] ? Number(rows[0].beam_usd) : null;
}

// Deepest BEAM-quoted pool per asset: `asset_aid`, `beam_reserve`,
// `asset_reserve`. Latest snapshot per pool via a per-pool LATERAL seek
// (indexed LIMIT 1) instead of a DISTINCT ON over the whole
// pool_state_snapshots hypertable, which full-scans (~4.5s).
function deepestBeamPoolsCte(includeDestroyed: boolean): string {
  return `
    SELECT DISTINCT ON (p.aid2) p.aid2 AS asset_aid,
           l.reserve1::numeric AS beam_reserve, l.reserve2::numeric AS asset_reserve
      FROM pools p
      CROSS JOIN LATERAL (
        SELECT reserve1, reserve2
          FROM pool_state_snapshots ss
         WHERE ss.pool_id = p.pool_id
         ORDER BY ss.ts DESC
         LIMIT 1
      ) l
     WHERE p.aid1 = 0 AND l.reserve1 > 0 AND l.reserve2 > 0
       ${includeDestroyed ? '' : 'AND p.destroyed_at_height IS NULL'}
     ORDER BY p.aid2, l.reserve1 DESC`;
}

async function fetchUsdTable(): Promise<UsdTable> {
  const beamUsd = await readBeamUsd();

  const perAid = new Map<number, number>();
  // BEAM itself: 1 whole BEAM = beamUsd USD.
  if (beamUsd !== null) perAid.set(0, beamUsd);

  if (beamUsd === null) return { beam_usd: beamUsd, perAid };

  const { rows } = await q<DeepestPoolRow>(`
    WITH beam_paired AS (${deepestBeamPoolsCte(false)})
    SELECT bp.asset_aid::text AS aid_other, bp.beam_reserve::text,
           bp.asset_reserve::text AS other_reserve, a2.decimals AS other_decimals
      FROM beam_paired bp
      JOIN assets a2 ON a2.aid = bp.asset_aid
  `);

  for (const r of rows) {
    const aid = Number(r.aid_other);
    const beamReserve = Number(r.beam_reserve) / 1e8;  // BEAM has 8 decimals
    const otherReserve = Number(r.other_reserve) / 10 ** r.other_decimals;
    if (otherReserve <= 0) continue;
    // BEAM per 1 whole aid = beamReserve / otherReserve
    const beamPerWholeAid = beamReserve / otherReserve;
    perAid.set(aid, beamPerWholeAid * beamUsd);
  }

  return { beam_usd: beamUsd, perAid };
}

async function fetchAssetPrices(): Promise<Map<number, AssetPrice>> {
  const { rows } = await q<{ aid: string; decimals: number; symbol: string | null; usd_per_unit: string | null }>(
    `WITH beam AS (
       SELECT beam_usd AS usd FROM oracle_snapshots ORDER BY ts DESC LIMIT 1
     ),
     beam_paired AS (${deepestBeamPoolsCte(true)})
     SELECT a.aid::text AS aid,
            a.decimals,
            COALESCE(a.short_name, a.unit_name, a.name) AS symbol,
            CASE
              WHEN a.aid = 0 THEN (SELECT usd FROM beam)
              WHEN bp.beam_reserve IS NOT NULL THEN
                (bp.beam_reserve / 1e8::numeric)
                / NULLIF(bp.asset_reserve / power(10::numeric, a.decimals), 0)
                * (SELECT usd FROM beam)
              ELSE NULL
            END::text AS usd_per_unit
       FROM assets a
       LEFT JOIN beam_paired bp ON bp.asset_aid = a.aid`,
  );
  const m = new Map<number, AssetPrice>();
  for (const r of rows) {
    const aid = Number(r.aid);
    m.set(aid, {
      aid,
      decimals: r.decimals,
      symbol: r.symbol ?? `aid:${aid}`,
      usdPerUnit: r.usd_per_unit != null ? Number(r.usd_per_unit) : null,
    });
  }
  return m;
}

/** USD value of `amountGroths` of an asset, or null when the asset is unpriceable. */
export function valueUsd(price: AssetPrice | undefined, amountGroths: string | bigint): number | null {
  if (!price || price.usdPerUnit == null) return null;
  const whole = Number(amountGroths) / Math.pow(10, price.decimals);
  return whole * price.usdPerUnit;
}
