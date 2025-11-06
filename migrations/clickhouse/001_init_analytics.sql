-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS cortex;

USE cortex;

-- Raw events table
CREATE TABLE IF NOT EXISTS events
(
    -- Event Identification
    event_id String,
    tenant_id String DEFAULT 'default',
    
    -- Service & Routing
    service String,
    route String DEFAULT '',
    method String DEFAULT '',
    
    -- Event Metadata
    type String,
    status Int32,
    status_code Int32,
    source String,  -- 'kong' | 'direct'
    
    -- Performance Metrics
    latency_ms Float64,
    bytes_in Int64 DEFAULT 0,
    bytes_out Int64 DEFAULT 0,
    
    -- Timestamps
    ts DateTime,           -- Event timestamp (from event)
    ingested_at DateTime DEFAULT now(),  -- Processing timestamp
    
    -- Correlation
    request_id String DEFAULT '',
    correlation_id String DEFAULT '',
    
    -- Error Information
    error_code String DEFAULT '',
    error_class String DEFAULT '',
    
    -- Dimensions (for filtering)
    region String DEFAULT '',
    cluster String DEFAULT '',
    env String DEFAULT 'production',
    
    -- User Context (hashed, no PII)
    user_hash String DEFAULT '',
    
    -- Metadata (JSON string for flexibility)
    metadata String DEFAULT ''
)
ENGINE = ReplacingMergeTree(ingested_at)
PARTITION BY toYYYYMM(ts)
ORDER BY (service, ts, event_id)
TTL ts + INTERVAL 14 DAY;

-- Materialized View: 1-Minute Rollups
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_1m
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(window_start)
ORDER BY (service, window_start, route, method, status_code)
AS SELECT
    toStartOfMinute(ts) AS window_start,
    tenant_id,
    service,
    route,
    method,
    status_code,
    
    -- Aggregations
    countState() AS count_total,
    countIfState(status < 400) AS count_success,
    countIfState(status >= 400) AS count_error,
    
    quantileState(0.50)(latency_ms) AS p50_latency,
    quantileState(0.95)(latency_ms) AS p95_latency,
    quantileState(0.99)(latency_ms) AS p99_latency,
    
    avgState(latency_ms) AS avg_latency,
    sumState(bytes_in) AS total_bytes_in,
    sumState(bytes_out) AS total_bytes_out,
    
    -- Error tracking
    uniqStateIf(error_code, error_code != '') AS unique_errors
    
FROM events
GROUP BY window_start, tenant_id, service, route, method, status_code;

-- Materialized View: 5-Minute Rollups
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_5m
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(window_start)
ORDER BY (service, window_start, route, method, status_code)
AS SELECT
    toStartOfFiveMinute(ts) AS window_start,
    tenant_id,
    service,
    route,
    method,
    status_code,
    
    -- Aggregations
    countState() AS count_total,
    countIfState(status < 400) AS count_success,
    countIfState(status >= 400) AS count_error,
    
    quantileState(0.50)(latency_ms) AS p50_latency,
    quantileState(0.95)(latency_ms) AS p95_latency,
    quantileState(0.99)(latency_ms) AS p99_latency,
    
    avgState(latency_ms) AS avg_latency,
    sumState(bytes_in) AS total_bytes_in,
    sumState(bytes_out) AS total_bytes_out,
    
    -- Error tracking
    uniqStateIf(error_code, error_code != '') AS unique_errors
    
FROM events
GROUP BY window_start, tenant_id, service, route, method, status_code;

-- Materialized View: 15-Minute Rollups
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_15m
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(window_start)
ORDER BY (service, window_start, route, method, status_code)
AS SELECT
    toStartOfFifteenMinutes(ts) AS window_start,
    tenant_id,
    service,
    route,
    method,
    status_code,
    
    -- Aggregations
    countState() AS count_total,
    countIfState(status < 400) AS count_success,
    countIfState(status >= 400) AS count_error,
    
    quantileState(0.50)(latency_ms) AS p50_latency,
    quantileState(0.95)(latency_ms) AS p95_latency,
    quantileState(0.99)(latency_ms) AS p99_latency,
    
    avgState(latency_ms) AS avg_latency,
    sumState(bytes_in) AS total_bytes_in,
    sumState(bytes_out) AS total_bytes_out,
    
    -- Error tracking
    uniqStateIf(error_code, error_code != '') AS unique_errors
    
FROM events
GROUP BY window_start, tenant_id, service, route, method, status_code;

-- Materialized View: 1-Hour Rollups
CREATE MATERIALIZED VIEW IF NOT EXISTS metrics_1h
ENGINE = AggregatingMergeTree()
PARTITION BY toYYYYMM(window_start)
ORDER BY (service, window_start, route, method, status_code)
AS SELECT
    toStartOfHour(ts) AS window_start,
    tenant_id,
    service,
    route,
    method,
    status_code,
    
    -- Aggregations
    countState() AS count_total,
    countIfState(status < 400) AS count_success,
    countIfState(status >= 400) AS count_error,
    
    quantileState(0.50)(latency_ms) AS p50_latency,
    quantileState(0.95)(latency_ms) AS p95_latency,
    quantileState(0.99)(latency_ms) AS p99_latency,
    
    avgState(latency_ms) AS avg_latency,
    sumState(bytes_in) AS total_bytes_in,
    sumState(bytes_out) AS total_bytes_out,
    
    -- Error tracking
    uniqStateIf(error_code, error_code != '') AS unique_errors
    
FROM events
GROUP BY window_start, tenant_id, service, route, method, status_code;

