-- THUL-NURAYN v1 — 005 — Execution
-- orders, fills, positions  (execution LOGIC is NOT implemented in D1)

CREATE TABLE IF NOT EXISTS orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_id       UUID REFERENCES signals(id) ON DELETE SET NULL,
    instrument_id   UUID NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
    user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
    direction       direction NOT NULL,
    order_type      TEXT NOT NULL DEFAULT 'MARKET',
    quantity        NUMERIC(20, 8) NOT NULL CHECK (quantity > 0),
    limit_price     NUMERIC(18, 8) CHECK (limit_price IS NULL OR limit_price > 0),
    stop_price      NUMERIC(18, 8) CHECK (stop_price  IS NULL OR stop_price  > 0),
    status          order_status NOT NULL DEFAULT 'PENDING',
    broker_order_id TEXT,
    submitted_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- fills: explicit first-class entity (per D1 validation checklist).
CREATE TABLE IF NOT EXISTS fills (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    fill_quantity NUMERIC(20, 8) NOT NULL CHECK (fill_quantity > 0),
    fill_price    NUMERIC(18, 8) NOT NULL CHECK (fill_price > 0),
    commission    NUMERIC(18, 8) NOT NULL DEFAULT 0 CHECK (commission >= 0),
    broker_exec_id TEXT,
    filled_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS positions (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instrument_id    UUID NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
    user_id          UUID REFERENCES users(id) ON DELETE SET NULL,
    direction        direction NOT NULL,
    quantity         NUMERIC(20, 8) NOT NULL,
    avg_entry_price  NUMERIC(18, 8) NOT NULL CHECK (avg_entry_price > 0),
    current_price    NUMERIC(18, 8),
    unrealized_pnl   NUMERIC(20, 8) NOT NULL DEFAULT 0,
    realized_pnl     NUMERIC(20, 8) NOT NULL DEFAULT 0,
    status           position_status NOT NULL DEFAULT 'OPEN',
    opened_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at        TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
