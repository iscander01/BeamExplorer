-- Rebuild candles_1d so its watermark no longer sits past the open daily
-- bucket. Before migration 056 and the bounded indexer refresh, a full
-- refresh materialized the open bucket, which moved the watermark to the
-- next day; real-time aggregation then ignored new trades in that bucket.
-- Recreating the view resets the watermark. The indexer's startup catch-up
-- (refreshAllAggregates) repopulates history up to the current bucket.
DROP MATERIALIZED VIEW candles_1d;

CREATE MATERIALIZED VIEW candles_1d
WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT pool_id,
       time_bucket(INTERVAL '1 day', block_ts) AS bucket,
       first(price_native, block_ts)          AS open,
       max(price_native)                       AS high,
       min(price_native)                       AS low,
       last(price_native, block_ts)           AS close,
       sum(volume_aid1)                        AS volume_aid1,
       sum(volume_aid2)                        AS volume_aid2,
       count(*)                                AS trade_count
FROM trades
WHERE confirmed = TRUE AND price_native IS NOT NULL AND price_native > 0
GROUP BY pool_id, bucket
WITH NO DATA;

SELECT add_continuous_aggregate_policy('candles_1d',
  start_offset      => INTERVAL '90 days',
  end_offset        => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 day');

-- Force the indexer's startup catch-up to run refreshAllAggregates.
UPDATE cursor SET aggregates_refreshed_at_height = 0;
