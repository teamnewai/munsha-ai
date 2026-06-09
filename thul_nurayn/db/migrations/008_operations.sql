-- THUL-NURAYN v1 — 008 — Operations
-- audit_logs (RANGE-partitioned), system_events (RANGE-partitioned)
-- Both are append-only and nothing FKs into them → safe to partition.

CREATE TABLE IF NOT EXISTS audit_logs (
    id          UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id     UUID,                       -- soft ref (no FK on partitioned table)
    action      TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id   UUID,
    before      JSONB,
    after       JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- system_events: explicit first-class entity (per D1 validation checklist).
CREATE TABLE IF NOT EXISTS system_events (
    id          UUID NOT NULL DEFAULT gen_random_uuid(),
    event_type  TEXT NOT NULL,
    severity    severity_level NOT NULL DEFAULT 'INFO',
    source      TEXT,
    message     TEXT NOT NULL,
    payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);
