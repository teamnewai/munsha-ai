-- THUL-NURAYN v1 — 007 — Intelligence
-- news_events, earnings_events
-- Not partitioned: referenced by the signal_* junction tables via FK.
-- (News/Monitoring ENGINE logic is NOT implemented in D1.)

CREATE TABLE IF NOT EXISTS news_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instrument_id UUID REFERENCES instruments(id) ON DELETE SET NULL,
    headline      TEXT NOT NULL,
    body          TEXT,
    source        TEXT,
    url           TEXT,
    sentiment     NUMERIC(6, 4) CHECK (sentiment IS NULL OR (sentiment >= -1 AND sentiment <= 1)),
    severity      severity_level NOT NULL DEFAULT 'INFO',
    published_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS earnings_events (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instrument_id     UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    report_date       TIMESTAMPTZ NOT NULL,
    fiscal_period     TEXT,
    eps_estimate      NUMERIC(18, 6),
    eps_actual        NUMERIC(18, 6),
    revenue_estimate  NUMERIC(24, 4),
    revenue_actual    NUMERIC(24, 4),
    surprise_pct      NUMERIC(10, 4),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
