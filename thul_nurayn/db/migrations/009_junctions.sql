-- THUL-NURAYN v1 — 009 — Junction / relationship tables
-- signal_news, signal_earnings (many-to-many)

CREATE TABLE IF NOT EXISTS signal_news (
    signal_id     UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
    news_event_id UUID NOT NULL REFERENCES news_events(id) ON DELETE CASCADE,
    relevance     NUMERIC(6, 4) CHECK (relevance IS NULL OR (relevance >= 0 AND relevance <= 1)),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (signal_id, news_event_id)
);

CREATE TABLE IF NOT EXISTS signal_earnings (
    signal_id          UUID NOT NULL REFERENCES signals(id) ON DELETE CASCADE,
    earnings_event_id  UUID NOT NULL REFERENCES earnings_events(id) ON DELETE CASCADE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (signal_id, earnings_event_id)
);
