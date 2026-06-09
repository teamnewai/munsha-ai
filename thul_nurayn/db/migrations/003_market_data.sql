-- THUL-NURAYN v1 — 003 — Market data
-- market_snapshots (RANGE-partitioned by month on snapshot_time)
-- scanner_results  (not partitioned; referenced by signals via FK)

-- market_snapshots: append-only, high-volume time-series. Nothing FKs into it,
-- so it is safe to declaratively partition. Partition key must be part of PK.
CREATE TABLE IF NOT EXISTS market_snapshots (
    id            UUID NOT NULL DEFAULT gen_random_uuid(),
    instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    snapshot_time TIMESTAMPTZ NOT NULL,
    open          NUMERIC(18, 8) NOT NULL CHECK (open  > 0),
    high          NUMERIC(18, 8) NOT NULL CHECK (high  > 0),
    low           NUMERIC(18, 8) NOT NULL CHECK (low   > 0),
    close         NUMERIC(18, 8) NOT NULL CHECK (close > 0),
    volume        BIGINT NOT NULL DEFAULT 0 CHECK (volume >= 0),
    vwap          NUMERIC(18, 8),
    regime        market_regime NOT NULL DEFAULT 'UNKNOWN',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT market_snapshots_ohlc_ck
        CHECK (high >= low AND high >= open AND high >= close
               AND low <= open AND low <= close),
    PRIMARY KEY (id, snapshot_time)
) PARTITION BY RANGE (snapshot_time);

CREATE UNIQUE INDEX IF NOT EXISTS uq_market_snapshots_instr_time
    ON market_snapshots (instrument_id, snapshot_time, id);

-- scanner_results: produced by the scanner engine (logic NOT in D1).
CREATE TABLE IF NOT EXISTS scanner_results (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instrument_id UUID NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
    engine_type   engine_type NOT NULL,
    scan_time     TIMESTAMPTZ NOT NULL,
    passed        BOOLEAN NOT NULL DEFAULT FALSE,
    metrics       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
