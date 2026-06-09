-- THUL-NURAYN v1 — 002 — Reference / identity entities
-- users, sectors, instruments

CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       TEXT NOT NULL UNIQUE,
    full_name   TEXT,
    role        user_role NOT NULL DEFAULT 'VIEWER',
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sectors (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code        TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS instruments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol          TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    sector_id       UUID REFERENCES sectors(id) ON DELETE SET NULL,
    exchange        TEXT,
    currency        TEXT NOT NULL DEFAULT 'USD',
    instrument_type TEXT NOT NULL DEFAULT 'EQUITY',
    tick_size       NUMERIC(18, 8) NOT NULL DEFAULT 0.01 CHECK (tick_size > 0),
    lot_size        INTEGER NOT NULL DEFAULT 1 CHECK (lot_size > 0),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
