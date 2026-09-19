-- The candle aggregates' refresh policies use end_offset = bucket width, so a
-- materialized-only read omits the open bucket and lags the newest closed one
-- by up to two bucket widths (48h on candles_1d). Real-time aggregation makes
-- the views include the not-yet-materialized tail, so every timeframe shows
-- the same latest price. Same treatment as liquidity_1h in migration 040.
ALTER MATERIALIZED VIEW candles_1m  SET (timescaledb.materialized_only = false);
ALTER MATERIALIZED VIEW candles_5m  SET (timescaledb.materialized_only = false);
ALTER MATERIALIZED VIEW candles_15m SET (timescaledb.materialized_only = false);
ALTER MATERIALIZED VIEW candles_1h  SET (timescaledb.materialized_only = false);
ALTER MATERIALIZED VIEW candles_4h  SET (timescaledb.materialized_only = false);
ALTER MATERIALIZED VIEW candles_1d  SET (timescaledb.materialized_only = false);
