// Bucketed cross-rate USD pricing, shared by every chart and stat that values
// pool reserves or trade volumes in USD. Per bucket: BEAM/USD is the oracle's
// last row; a non-BEAM asset is priced through the BEAM-paired pool with the
// largest BEAM reserve in that bucket (less manipulable than "freshest wins").
// A pool whose sides are both unreachable prices to NULL.

/** Scan window on the source tables' timestamp column. `$n` binds a query parameter. */
export type CrossRateWindow =
  | 'all'
  | { recentDays: number }
  | { from: number; to: number }
  | { sinceParam: number };

/** Where end-of-bucket reserves come from. `liquidity_1h` is the hourly
 *  continuous aggregate (last-per-bucket over it equals last-per-bucket over the
 *  raw snapshots for any bucket ≥ 1h); sub-hour buckets need the raw table. */
export type ReserveSource = 'liquidity_1h' | 'pool_state_snapshots';

function where(col: string, w: CrossRateWindow): string {
  if (w === 'all') return '';
  if ('recentDays' in w) return `WHERE ${col} > now() - INTERVAL '${w.recentDays} days'`;
  if ('sinceParam' in w) return `WHERE ${col} >= $${w.sinceParam}`;
  return `WHERE ${col} >= to_timestamp(${w.from}) AND ${col} < to_timestamp(${w.to})`;
}

/**
 * The `oracle_b`, `pool_b` and `beam_paired` CTEs (without the leading WITH),
 * bucketed by `bucket` (a PG interval expression) on column `b`. Splice ahead
 * of a `pricedSelect` consumer.
 */
export function crossRateCtes(bucket: string, window: CrossRateWindow, reserves: ReserveSource): string {
  const tsCol = reserves === 'liquidity_1h' ? 'bucket' : 'ts';
  return `oracle_b AS (
    SELECT time_bucket(${bucket}, ts) AS b, last(beam_usd, ts) AS beam_usd
      FROM oracle_snapshots
     ${where('ts', window)}
     GROUP BY 1
  ),
  pool_b AS (
    SELECT pool_id, time_bucket(${bucket}, ${tsCol}) AS b,
           last(reserve1, ${tsCol})::numeric AS reserve1,
           last(reserve2, ${tsCol})::numeric AS reserve2
      FROM ${reserves}
     ${where(tsCol, window)}
     GROUP BY pool_id, time_bucket(${bucket}, ${tsCol})
  ),
  beam_paired AS (
    SELECT DISTINCT ON (pb.b, p.aid2)
           pb.b, p.aid2 AS asset_aid,
           pb.reserve1::numeric AS beam_reserve, pb.reserve2::numeric AS asset_reserve
      FROM pool_b pb JOIN pools p ON p.pool_id = pb.pool_id
     WHERE p.aid1 = 0 AND pb.reserve1 > 0 AND pb.reserve2 > 0
     ORDER BY pb.b, p.aid2, pb.reserve1 DESC
  )`;
}

export interface PricedSelect {
  /** Source CTE with `pool_id`, `b` and the two side columns; aliased `s`. */
  from: string;
  /** Per-side amount columns on `s`, in groths of aid1 / aid2. */
  cols: [string, string];
  /** Output column name for the USD value. */
  as: string;
  /** Multiply by 2 — a pool holds equal value on both sides at equilibrium. */
  double?: boolean;
  /** Extra columns carried through, e.g. `s.pool_id,`. */
  select?: string;
  /** Trailing predicate on `s`, without WHERE. */
  where?: string;
}

/** SELECT body pricing each `from` row in USD via the CTEs above; wrap it in
 *  your own `name AS (...)`. Emits `b`, `select` columns and `as`. */
export function pricedSelect(o: PricedSelect): string {
  const f = o.double ? '2 * ' : '';
  const [c1, c2] = o.cols;
  return `SELECT s.b, ${o.select ?? ''}
           CASE
             WHEN p.aid1 = 0 AND od.beam_usd IS NOT NULL THEN
               ${f}(s.${c1} / 1e8::numeric) * od.beam_usd
             WHEN bp1.beam_reserve IS NOT NULL AND od.beam_usd IS NOT NULL THEN
               ${f}(s.${c1} / power(10::numeric, a1.decimals))
                 * (bp1.beam_reserve / 1e8::numeric)
                 / NULLIF(bp1.asset_reserve / power(10::numeric, a1.decimals), 0)
                 * od.beam_usd
             WHEN bp2.beam_reserve IS NOT NULL AND od.beam_usd IS NOT NULL THEN
               ${f}(s.${c2} / power(10::numeric, a2.decimals))
                 * (bp2.beam_reserve / 1e8::numeric)
                 / NULLIF(bp2.asset_reserve / power(10::numeric, a2.decimals), 0)
                 * od.beam_usd
           END AS ${o.as}
      FROM ${o.from} s
      JOIN pools  p  ON p.pool_id = s.pool_id
      JOIN assets a1 ON a1.aid = p.aid1
      JOIN assets a2 ON a2.aid = p.aid2
      LEFT JOIN oracle_b    od  ON od.b  = s.b
      LEFT JOIN beam_paired bp1 ON bp1.b = s.b AND bp1.asset_aid = p.aid1
      LEFT JOIN beam_paired bp2 ON bp2.b = s.b AND bp2.asset_aid = p.aid2
     ${o.where ? `WHERE ${o.where}` : ''}`;
}

/** Sum of USD-priced pool reserves per bucket: `ts`, `value`. */
export function tvlSql(bucket: string, window: CrossRateWindow, reserves: ReserveSource): string {
  return `
  WITH ${crossRateCtes(bucket, window, reserves)},
  priced AS (
    ${pricedSelect({ from: 'pool_b', cols: ['reserve1', 'reserve2'], as: 'tvl_usd', double: true, where: 's.reserve1 > 0 OR s.reserve2 > 0' })}
  )
  SELECT EXTRACT(epoch FROM b)::bigint AS ts, SUM(tvl_usd)::float8 AS value
    FROM priced WHERE tvl_usd IS NOT NULL GROUP BY b ORDER BY 1
  `;
}
