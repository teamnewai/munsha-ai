-- THUL-NURAYN v1 — 006 — Risk & portfolio telemetry
-- risk_snapshots (RANGE-partitioned by month), performance_records

-- risk_snapshots: append-only portfolio risk telemetry. Nothing FKs into it,
-- so it is declaratively partitioned. Partition key part of PK.
CREATE TABLE IF NOT EXISTS risk_snapshots (
    id             UUID NOT NULL DEFAULT gen_random_uuid(),
    user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    snapshot_time  TIMESTAMPTZ NOT NULL,
    gross_exposure NUMERIC(20, 8) NOT NULL DEFAULT 0,
    net_exposure   NUMERIC(20, 8) NOT NULL DEFAULT 0,
    total_pnl      NUMERIC(20, 8) NOT NULL DEFAULT 0,
    drawdown       NUMERIC(20, 8) NOT NULL DEFAULT 0,
    open_positions INTEGER NOT NULL DEFAULT 0 CHECK (open_positions >= 0),
    metrics        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, snapshot_time)
) PARTITION BY RANGE (snapshot_time);

-- performance_records: periodic performance rollups (lower volume).
CREATE TABLE IF NOT EXISTS performance_records (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    period_start  TIMESTAMPTZ NOT NULL,
    period_end    TIMESTAMPTZ NOT NULL,
    total_return  NUMERIC(20, 8) NOT NULL DEFAULT 0,
    sharpe        NUMERIC(12, 6),
    max_drawdown  NUMERIC(20, 8),
    win_rate      NUMERIC(6, 4) CHECK (win_rate IS NULL OR (win_rate >= 0 AND win_rate <= 1)),
    num_trades    INTEGER NOT NULL DEFAULT 0 CHECK (num_trades >= 0),
    metrics       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT performance_period_ck CHECK (period_end >= period_start)
);
