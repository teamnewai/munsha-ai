-- THUL-NURAYN v1 — 012 — Retention & archival structure
-- PostgreSQL remains the SOURCE OF TRUTH. Retention here means moving cold
-- partitions out of the hot path (DETACH → archive schema) rather than
-- destroying data, so durable history is preserved.
--
-- ASSUMPTION FLAG (CR-001): retention windows below are conservative defaults;
-- reconcile against the authoritative spec when supplied.

CREATE SCHEMA IF NOT EXISTS archive;

-- Retention policy registry (data-driven; one row per partitioned table). ----
CREATE TABLE IF NOT EXISTS retention_policies (
    parent_table   TEXT PRIMARY KEY,
    retain_months  INTEGER NOT NULL CHECK (retain_months > 0),
    action         TEXT NOT NULL DEFAULT 'ARCHIVE'  -- ARCHIVE | DROP
        CHECK (action IN ('ARCHIVE', 'DROP')),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO retention_policies (parent_table, retain_months, action) VALUES
    ('market_snapshots', 24, 'ARCHIVE'),
    ('risk_snapshots',   24, 'ARCHIVE'),
    ('audit_logs',       84, 'ARCHIVE'),   -- 7y for audit
    ('system_events',    12, 'ARCHIVE')
ON CONFLICT (parent_table) DO NOTHING;

-- Detach + archive partitions older than the policy window. ------------------
-- Detaches each child whose entire range is older than the cutoff and moves
-- it into the `archive` schema (ARCHIVE) or drops it (DROP).
CREATE OR REPLACE FUNCTION tn_apply_retention(parent_table TEXT)
RETURNS INTEGER AS $$
DECLARE
    policy        retention_policies%ROWTYPE;
    cutoff        DATE;
    child         RECORD;
    bound_to      TEXT;
    upper_bound   TIMESTAMPTZ;
    moved         INTEGER := 0;
BEGIN
    SELECT * INTO policy FROM retention_policies WHERE retention_policies.parent_table = $1;
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    cutoff := (date_trunc('month', now()) - (policy.retain_months || ' month')::interval)::date;

    FOR child IN
        SELECT c.relname AS name,
               pg_get_expr(c.relpartbound, c.oid) AS bound
        FROM pg_inherits i
        JOIN pg_class c   ON c.oid = i.inhrelid
        JOIN pg_class p   ON p.oid = i.inhparent
        WHERE p.relname = $1
          AND pg_get_expr(c.relpartbound, c.oid) <> 'DEFAULT'
    LOOP
        -- Extract the upper bound (TO ('...')) of the range.
        bound_to := substring(child.bound FROM 'TO \(''([^'']+)''\)');
        CONTINUE WHEN bound_to IS NULL;
        upper_bound := bound_to::timestamptz;
        IF upper_bound <= cutoff THEN
            EXECUTE format('ALTER TABLE %I DETACH PARTITION %I;', $1, child.name);
            IF policy.action = 'DROP' THEN
                EXECUTE format('DROP TABLE %I;', child.name);
            ELSE
                EXECUTE format('ALTER TABLE %I SET SCHEMA archive;', child.name);
            END IF;
            moved := moved + 1;
        END IF;
    END LOOP;
    RETURN moved;
END;
$$ LANGUAGE plpgsql;

-- Convenience: apply retention across all registered policies.
CREATE OR REPLACE FUNCTION tn_apply_all_retention()
RETURNS INTEGER AS $$
DECLARE
    p   RECORD;
    tot INTEGER := 0;
BEGIN
    FOR p IN SELECT parent_table FROM retention_policies LOOP
        tot := tot + tn_apply_retention(p.parent_table);
    END LOOP;
    RETURN tot;
END;
$$ LANGUAGE plpgsql;

-- NOTE: scheduling (pg_cron / external scheduler) is an OPERATIONS concern
-- (phase D8) and is intentionally NOT wired up in D1.
