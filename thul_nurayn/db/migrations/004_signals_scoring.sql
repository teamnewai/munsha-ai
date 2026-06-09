-- THUL-NURAYN v1 — 004 — Signals, scoring, risk-gate
-- signals, scores, risk_checks  (engine LOGIC is NOT implemented in D1)

CREATE TABLE IF NOT EXISTS signals (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instrument_id      UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    scanner_result_id  UUID REFERENCES scanner_results(id) ON DELETE SET NULL,
    engine_type        engine_type NOT NULL,
    direction          direction NOT NULL,
    regime             market_regime NOT NULL DEFAULT 'UNKNOWN',
    generated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at         TIMESTAMPTZ,
    metadata           JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One canonical score per signal.
CREATE TABLE IF NOT EXISTS scores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id       UUID NOT NULL UNIQUE REFERENCES signals(id) ON DELETE CASCADE,
    composite_score NUMERIC(12, 6) NOT NULL,
    components      JSONB NOT NULL DEFAULT '{}'::jsonb,
    scored_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Risk-gate outcome. Fail-safe: default decision is the conservative REJECTED.
CREATE TABLE IF NOT EXISTS risk_checks (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id   UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
    decision    risk_decision NOT NULL DEFAULT 'REJECTED',
    reason      TEXT,
    checks      JSONB NOT NULL DEFAULT '{}'::jsonb,
    checked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
