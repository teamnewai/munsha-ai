-- ============================================================================
-- THUL-NURAYN v1 — partition_retention  (Phase B1 / D1 Foundation)
-- ============================================================================
-- Partition strategy (D1_FOUNDATION_REPORT §7):
--   Time-based RANGE partitioning, MONTHLY, for the 6 high-volume tables:
--     signals · orders · audit_logs · system_events · market_snapshots · risk_snapshots
--   (The partitioned PARENT tables are declared in 001_init_schema.sql.)
--
-- Retention strategy (D1_FOUNDATION_REPORT §7):
--   Tiering: Hot -> Warm -> Cold.
--     Hot  : current/recent months on primary storage (fast access).
--     Warm : older months retained on standard storage.
--     Cold : archived months (audit / back-test / compliance).
--   Audit & compliance data is ARCHIVED — never deleted.
--   Concrete retention windows / tier durations: To be produced during a later
--   phase (operational; no numeric windows are specified in the approved sources).
--
-- Partition naming convention: <table>_pYYYYMM  (one partition per calendar month).
-- The examples below illustrate the convention (sample month: 2026-06).
-- Monthly partition provisioning is automated operationally (later phase);
-- this file records the convention and the retention policy.
-- Live application is B7, not B1.
-- ============================================================================

-- ---- market_snapshots --------------------------------------------------------
CREATE TABLE market_snapshots_p202606 PARTITION OF market_snapshots
    FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

-- ---- signals -----------------------------------------------------------------
CREATE TABLE signals_p202606 PARTITION OF signals
    FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

-- ---- orders ------------------------------------------------------------------
CREATE TABLE orders_p202606 PARTITION OF orders
    FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

-- ---- risk_snapshots ----------------------------------------------------------
CREATE TABLE risk_snapshots_p202606 PARTITION OF risk_snapshots
    FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

-- ---- audit_logs  (APPEND-ONLY; Cold tier archived, never deleted) ------------
CREATE TABLE audit_logs_p202606 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

-- ---- system_events  (APPEND-ONLY; Cold tier archived, never deleted) ---------
CREATE TABLE system_events_p202606 PARTITION OF system_events
    FOR VALUES FROM ('2026-06-01 00:00:00+00') TO ('2026-07-01 00:00:00+00');

-- ============================================================================
-- Retention tiering summary (Hot -> Warm -> Cold):
--   * Hot  : recent monthly partitions on primary storage.
--   * Warm : older monthly partitions retained.
--   * Cold : archived monthly partitions for audit / back-test.
--   * audit_logs & system_events: archived to Cold and NEVER deleted.
-- ============================================================================
