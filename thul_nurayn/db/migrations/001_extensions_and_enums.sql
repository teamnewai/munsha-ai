-- THUL-NURAYN v1 — 001 — Extensions & Enum Types
-- PostgreSQL is the SOURCE OF TRUTH.
-- ASSUMPTION FLAG (CR-001): enum members reconstructed from the D1 brief.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- Shared enumerations (mirror thul_nurayn/domain/enums.py) ------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'market_regime') THEN
        CREATE TYPE market_regime AS ENUM (
            'TRENDING_UP', 'TRENDING_DOWN', 'RANGE_BOUND',
            'HIGH_VOLATILITY', 'UNKNOWN');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'engine_type') THEN
        CREATE TYPE engine_type AS ENUM (
            'MOMENTUM', 'MEAN_REVERSION', 'BREAKOUT',
            'TREND_FOLLOWING', 'EVENT_DRIVEN');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'direction') THEN
        CREATE TYPE direction AS ENUM ('LONG', 'SHORT', 'FLAT');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
        CREATE TYPE order_status AS ENUM (
            'PENDING', 'SUBMITTED', 'PARTIALLY_FILLED', 'FILLED',
            'CANCELLED', 'REJECTED', 'EXPIRED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'position_status') THEN
        CREATE TYPE position_status AS ENUM ('OPEN', 'CLOSING', 'CLOSED');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM (
            'ADMIN', 'TRADER', 'ANALYST', 'VIEWER', 'SYSTEM');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'risk_decision') THEN
        CREATE TYPE risk_decision AS ENUM (
            'APPROVED', 'REJECTED', 'ADJUSTED', 'PENDING');
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'severity_level') THEN
        CREATE TYPE severity_level AS ENUM (
            'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL');
    END IF;
END$$;
