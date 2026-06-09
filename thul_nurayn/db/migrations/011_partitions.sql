-- THUL-NURAYN v1 — 011 — Partition strategy & management
-- Strategy: monthly RANGE partitions on the time column for the four
-- append-only, high-volume tables. A DEFAULT partition guarantees inserts
-- never fail if a monthly child has not yet been provisioned.
--
-- Partitioned tables:
--   market_snapshots  (snapshot_time)
--   risk_snapshots    (snapshot_time)
--   audit_logs        (created_at)
--   system_events     (created_at)

-- Generic helper: create one monthly partition for a parent table. ----------
CREATE OR REPLACE FUNCTION tn_create_monthly_partition(
    parent_table TEXT,
    month_start  DATE
) RETURNS VOID AS $$
DECLARE
    part_name TEXT;
    range_end DATE;
BEGIN
    part_name := format('%s_p%s', parent_table, to_char(month_start, 'YYYYMM'));
    range_end := (month_start + INTERVAL '1 month')::date;
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = part_name) THEN
        EXECUTE format(
            'CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L);',
            part_name, parent_table, month_start, range_end);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Ensure partitions for [from_month, from_month + n_months). ----------------
CREATE OR REPLACE FUNCTION tn_ensure_monthly_partitions(
    parent_table TEXT,
    from_month   DATE,
    n_months     INTEGER
) RETURNS VOID AS $$
DECLARE
    i INTEGER;
BEGIN
    FOR i IN 0 .. (n_months - 1) LOOP
        PERFORM tn_create_monthly_partition(
            parent_table,
            (date_trunc('month', from_month) + (i || ' month')::interval)::date);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- DEFAULT partitions (catch-all) --------------------------------------------
CREATE TABLE IF NOT EXISTS market_snapshots_default PARTITION OF market_snapshots DEFAULT;
CREATE TABLE IF NOT EXISTS risk_snapshots_default   PARTITION OF risk_snapshots   DEFAULT;
CREATE TABLE IF NOT EXISTS audit_logs_default       PARTITION OF audit_logs       DEFAULT;
CREATE TABLE IF NOT EXISTS system_events_default    PARTITION OF system_events    DEFAULT;

-- Provision the current month + 2 months ahead for each partitioned table.
SELECT tn_ensure_monthly_partitions('market_snapshots', date_trunc('month', now())::date, 3);
SELECT tn_ensure_monthly_partitions('risk_snapshots',   date_trunc('month', now())::date, 3);
SELECT tn_ensure_monthly_partitions('audit_logs',       date_trunc('month', now())::date, 3);
SELECT tn_ensure_monthly_partitions('system_events',    date_trunc('month', now())::date, 3);
