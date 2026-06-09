-- ============================================================================
-- THUL-NURAYN v1 — 001_init_schema  (Phase B1 / D1 Foundation)
-- ============================================================================
-- Scope: foundation only — 19 tables, enum CHECK constraints, UUID PKs,
--        FK ON DELETE RESTRICT, indexes, partition declarations.
--        No Scanner/Strategy/Risk/Execution/Portfolio/Broker logic.
-- Conventions (D1_FOUNDATION_REPORT §3, §5):
--   * Primary keys      : UUID (application-generated).
--   * Money             : NUMERIC (maps to Python Decimal).
--   * Timestamps        : TIMESTAMPTZ (timezone-aware, UTC).
--   * Enumerations      : TEXT + CHECK (value IN (...))  [enum CHECK constraints].
--   * Foreign keys      : ON DELETE RESTRICT.
-- Partitioned parents (monthly RANGE) are declared here; concrete monthly
-- partitions live in db/partitions/partition_retention.sql.
--
-- NOTE on partitioned-parent references: PostgreSQL foreign keys cannot target
-- only the surrogate id of a RANGE-partitioned table (the unique key must
-- include the partition column). For references INTO partitioned parents
-- (signals, orders, market_snapshots) the columns are stored + indexed here
-- and referential integrity is enforced in the D2 Data Access Layer. This is
-- a recorded B1 schema-design decision (see D1_BUILD_REPORT.md).
-- Live application of this schema to PostgreSQL is B7, not B1.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Reference entities
-- ----------------------------------------------------------------------------
CREATE TABLE sectors (
    id          UUID PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE users (
    id          UUID PRIMARY KEY,
    username    TEXT NOT NULL UNIQUE,
    role        TEXT NOT NULL CHECK (role IN ('Owner','Operator','Viewer')),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL
);

CREATE TABLE instruments (
    id          UUID PRIMARY KEY,
    symbol      TEXT NOT NULL UNIQUE,
    market      TEXT NOT NULL CHECK (market IN ('NASDAQ','NYSE')),
    sector_id   UUID NOT NULL REFERENCES sectors(id) ON DELETE RESTRICT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL
);

-- ----------------------------------------------------------------------------
-- Positions (referenced by orders and fills)
-- ----------------------------------------------------------------------------
CREATE TABLE positions (
    id            UUID PRIMARY KEY,
    instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
    engine        TEXT NOT NULL CHECK (engine IN ('Core','Turbo')),
    direction     TEXT NOT NULL CHECK (direction IN ('Long','Short')),
    status        TEXT NOT NULL CHECK (status IN ('Open','Closed')),
    quantity      INTEGER NOT NULL,
    entry_price   NUMERIC,
    exit_price    NUMERIC,
    opened_at     TIMESTAMPTZ NOT NULL,
    closed_at     TIMESTAMPTZ
);

-- ----------------------------------------------------------------------------
-- News / earnings
-- ----------------------------------------------------------------------------
CREATE TABLE news_events (
    id            UUID PRIMARY KEY,
    instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
    headline      TEXT,
    published_at  TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL
);

CREATE TABLE earnings_events (
    id            UUID PRIMARY KEY,
    instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
    surprise      NUMERIC,
    event_date    TIMESTAMPTZ NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL
);

-- ----------------------------------------------------------------------------
-- Performance records
-- ----------------------------------------------------------------------------
CREATE TABLE performance_records (
    id            UUID PRIMARY KEY,
    period_type   TEXT NOT NULL CHECK (period_type IN ('daily','weekly','monthly')),
    period_start  TIMESTAMPTZ NOT NULL,
    period_end    TIMESTAMPTZ NOT NULL,
    trades        INTEGER NOT NULL,
    wins          INTEGER NOT NULL,
    losses        INTEGER NOT NULL,
    realized_pnl  NUMERIC NOT NULL,
    win_rate      NUMERIC NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL
);

-- ----------------------------------------------------------------------------
-- Market snapshots  (PARTITIONED — monthly RANGE on captured_at)
-- ----------------------------------------------------------------------------
CREATE TABLE market_snapshots (
    id           UUID NOT NULL,
    captured_at  TIMESTAMPTZ NOT NULL,
    regime       TEXT NOT NULL CHECK (regime IN ('Bull','Bear','Sideways')),
    spy_price    NUMERIC NOT NULL,
    spy_sma_200  NUMERIC NOT NULL,
    vix          NUMERIC,          -- nullable (D1 §5)
    state        TEXT,             -- nullable (D1 §5)
    PRIMARY KEY (id, captured_at)
) PARTITION BY RANGE (captured_at);

-- ----------------------------------------------------------------------------
-- Signals  (PARTITIONED — monthly RANGE on created_at)
-- ----------------------------------------------------------------------------
CREATE TABLE signals (
    id            UUID NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL,
    instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
    engine        TEXT NOT NULL CHECK (engine IN ('Core','Turbo')),
    direction     TEXT NOT NULL CHECK (direction IN ('Long','Short')),
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- ----------------------------------------------------------------------------
-- Scanner results
-- ----------------------------------------------------------------------------
CREATE TABLE scanner_results (
    id                 UUID PRIMARY KEY,
    instrument_id      UUID NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
    engine             TEXT NOT NULL CHECK (engine IN ('Core','Turbo')),
    market_snapshot_id UUID,   -- ref market_snapshots (partitioned) — enforced in D2 DAL
    passed             BOOLEAN NOT NULL DEFAULT FALSE,
    rvol               NUMERIC,
    created_at         TIMESTAMPTZ NOT NULL
);

-- ----------------------------------------------------------------------------
-- Scores (1:1 Signal) and Risk Checks (1:1 Signal)
-- signal_id UNIQUE enforces the 1:1; FK into partitioned signals -> D2 DAL.
-- ----------------------------------------------------------------------------
CREATE TABLE scores (
    id             UUID PRIMARY KEY,
    signal_id      UUID NOT NULL UNIQUE,
    engine         TEXT NOT NULL CHECK (engine IN ('Core','Turbo')),
    total          NUMERIC NOT NULL,
    classification TEXT NOT NULL
                   CHECK (classification IN ('UltraGolden','Golden','Strong','Watchlist')),
    breakdown      JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at     TIMESTAMPTZ NOT NULL
);

CREATE TABLE risk_checks (
    id           UUID PRIMARY KEY,
    signal_id    UUID NOT NULL UNIQUE,
    decision     TEXT NOT NULL CHECK (decision IN ('Accepted','Rejected')),
    rejected_by  TEXT,
    created_at   TIMESTAMPTZ NOT NULL
);

-- ----------------------------------------------------------------------------
-- Orders  (PARTITIONED — monthly RANGE on created_at)
-- ----------------------------------------------------------------------------
CREATE TABLE orders (
    id            UUID NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL,
    signal_id     UUID,   -- ref signals (partitioned) — enforced in D2 DAL
    instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    position_id   UUID REFERENCES positions(id) ON DELETE RESTRICT,
    engine        TEXT NOT NULL CHECK (engine IN ('Core','Turbo')),
    direction     TEXT NOT NULL CHECK (direction IN ('Long','Short')),
    status        TEXT NOT NULL
                  CHECK (status IN ('New','Sent','Filled','Rejected','Cancelled')),
    quantity      INTEGER NOT NULL,
    broker_ref    TEXT,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- ----------------------------------------------------------------------------
-- Fills  (Order 1─* Fill · Fill *─1 Position)
-- order_id refs partitioned orders -> enforced in D2 DAL; position FK enforced.
-- ----------------------------------------------------------------------------
CREATE TABLE fills (
    id           UUID PRIMARY KEY,
    order_id     UUID NOT NULL,
    position_id  UUID NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
    quantity     INTEGER NOT NULL,
    price        NUMERIC NOT NULL,
    filled_at    TIMESTAMPTZ NOT NULL
);

-- ----------------------------------------------------------------------------
-- Risk snapshots  (PARTITIONED — monthly RANGE on captured_at)
-- ----------------------------------------------------------------------------
CREATE TABLE risk_snapshots (
    id                 UUID NOT NULL,
    captured_at        TIMESTAMPTZ NOT NULL,
    equity             NUMERIC NOT NULL,
    high_water_mark    NUMERIC NOT NULL,
    daily_drawdown     NUMERIC NOT NULL,
    weekly_drawdown    NUMERIC NOT NULL,
    open_positions     INTEGER NOT NULL,
    trades_today       INTEGER NOT NULL,
    consecutive_losses INTEGER NOT NULL,
    PRIMARY KEY (id, captured_at)
) PARTITION BY RANGE (captured_at);

-- ----------------------------------------------------------------------------
-- Bridges (many-to-many). signal_id refs partitioned signals -> D2 DAL.
-- ----------------------------------------------------------------------------
CREATE TABLE signal_news (
    signal_id      UUID NOT NULL,
    news_event_id  UUID NOT NULL REFERENCES news_events(id) ON DELETE RESTRICT,
    PRIMARY KEY (signal_id, news_event_id)
);

CREATE TABLE signal_earnings (
    signal_id          UUID NOT NULL,
    earnings_event_id  UUID NOT NULL REFERENCES earnings_events(id) ON DELETE RESTRICT,
    PRIMARY KEY (signal_id, earnings_event_id)
);

-- ----------------------------------------------------------------------------
-- Audit logs  (PARTITIONED — monthly RANGE on created_at)
-- APPEND-ONLY: no UPDATE / no DELETE permitted (enforced in D2 DAL).
-- ----------------------------------------------------------------------------
CREATE TABLE audit_logs (
    id          UUID NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL,
    event_type  TEXT NOT NULL
                CHECK (event_type IN ('Login','SettingRiskChange','Order','Shutdown','Error')),
    user_id     UUID REFERENCES users(id) ON DELETE RESTRICT,
    entity_ref  UUID,
    detail      JSONB,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- ----------------------------------------------------------------------------
-- System events  (PARTITIONED — monthly RANGE on created_at)
-- APPEND-ONLY: no UPDATE / no DELETE permitted (enforced in D2 DAL).
-- ----------------------------------------------------------------------------
CREATE TABLE system_events (
    id          UUID NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL,
    event_type  TEXT NOT NULL CHECK (event_type IN (
                    'ServiceStarted','ServiceStopped','WorkerFailure',
                    'RedisEvent','PostgresEvent','GatewayEvent',
                    'KillSwitchActivated','IBGatewayReconnected')),
    severity    TEXT NOT NULL CHECK (severity IN ('Warning','Critical','Emergency')),
    detail      JSONB,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- ----------------------------------------------------------------------------
-- Indexes on hot lookups: sector / state / classification / engine / time
-- (D1_FOUNDATION_REPORT §3)
-- ----------------------------------------------------------------------------
-- sector
CREATE INDEX idx_instruments_sector       ON instruments (sector_id);
-- state (status)
CREATE INDEX idx_orders_status            ON orders (status);
CREATE INDEX idx_positions_status         ON positions (status);
-- classification
CREATE INDEX idx_scores_classification    ON scores (classification);
-- engine
CREATE INDEX idx_signals_engine           ON signals (engine);
CREATE INDEX idx_orders_engine            ON orders (engine);
CREATE INDEX idx_scanner_results_engine   ON scanner_results (engine);
CREATE INDEX idx_positions_engine         ON positions (engine);
-- time
CREATE INDEX idx_market_snapshots_time    ON market_snapshots (captured_at);
CREATE INDEX idx_signals_time             ON signals (created_at);
CREATE INDEX idx_orders_time              ON orders (created_at);
CREATE INDEX idx_risk_snapshots_time      ON risk_snapshots (captured_at);
CREATE INDEX idx_audit_logs_time          ON audit_logs (created_at);
CREATE INDEX idx_system_events_time       ON system_events (created_at);
-- regime / event classification helpers
CREATE INDEX idx_market_snapshots_regime  ON market_snapshots (regime);
CREATE INDEX idx_audit_logs_event_type    ON audit_logs (event_type);
CREATE INDEX idx_system_events_event_type ON system_events (event_type);
CREATE INDEX idx_system_events_severity   ON system_events (severity);

-- ============================================================================
-- End 001_init_schema
-- ============================================================================
