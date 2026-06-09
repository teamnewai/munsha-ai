-- THUL-NURAYN v1 — 010 — Indexes
-- ASSUMPTION FLAG (CR-001): index set reconstructed to support the obvious
-- access paths of a quant pipeline; reconcile against Phase 4A when supplied.

-- instruments
CREATE INDEX IF NOT EXISTS ix_instruments_sector   ON instruments (sector_id);
CREATE INDEX IF NOT EXISTS ix_instruments_active   ON instruments (is_active) WHERE is_active;

-- market_snapshots (note: composite uq already created in 003)
CREATE INDEX IF NOT EXISTS ix_market_snap_time      ON market_snapshots (snapshot_time);

-- scanner_results
CREATE INDEX IF NOT EXISTS ix_scanner_instr_time    ON scanner_results (instrument_id, scan_time DESC);
CREATE INDEX IF NOT EXISTS ix_scanner_engine_passed ON scanner_results (engine_type, passed);

-- signals
CREATE INDEX IF NOT EXISTS ix_signals_instr_time    ON signals (instrument_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS ix_signals_engine        ON signals (engine_type);
CREATE INDEX IF NOT EXISTS ix_signals_scanner       ON signals (scanner_result_id);
CREATE INDEX IF NOT EXISTS ix_signals_active        ON signals (expires_at) WHERE expires_at IS NOT NULL;

-- scores / risk_checks
CREATE INDEX IF NOT EXISTS ix_risk_checks_signal    ON risk_checks (signal_id);
CREATE INDEX IF NOT EXISTS ix_risk_checks_decision  ON risk_checks (decision);

-- orders / fills / positions
CREATE INDEX IF NOT EXISTS ix_orders_status         ON orders (status);
CREATE INDEX IF NOT EXISTS ix_orders_instr          ON orders (instrument_id);
CREATE INDEX IF NOT EXISTS ix_orders_signal         ON orders (signal_id);
CREATE INDEX IF NOT EXISTS ix_orders_user           ON orders (user_id);
CREATE INDEX IF NOT EXISTS ix_fills_order           ON fills (order_id);
CREATE INDEX IF NOT EXISTS ix_fills_time            ON fills (filled_at);
CREATE INDEX IF NOT EXISTS ix_positions_status      ON positions (status);
CREATE INDEX IF NOT EXISTS ix_positions_instr       ON positions (instrument_id);
CREATE INDEX IF NOT EXISTS ix_positions_open        ON positions (user_id) WHERE status = 'OPEN';

-- risk_snapshots / performance
CREATE INDEX IF NOT EXISTS ix_risk_snap_user_time   ON risk_snapshots (user_id, snapshot_time DESC);
CREATE INDEX IF NOT EXISTS ix_perf_user_period      ON performance_records (user_id, period_start DESC);

-- intelligence
CREATE INDEX IF NOT EXISTS ix_news_instr_time       ON news_events (instrument_id, published_at DESC);
CREATE INDEX IF NOT EXISTS ix_news_published        ON news_events (published_at DESC);
CREATE INDEX IF NOT EXISTS ix_earnings_instr_date   ON earnings_events (instrument_id, report_date DESC);

-- operations
CREATE INDEX IF NOT EXISTS ix_audit_user_time       ON audit_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_entity          ON audit_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS ix_sysevents_type_time   ON system_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_sysevents_severity    ON system_events (severity, created_at DESC);

-- junctions (reverse lookups)
CREATE INDEX IF NOT EXISTS ix_signal_news_news      ON signal_news (news_event_id);
CREATE INDEX IF NOT EXISTS ix_signal_earn_earn      ON signal_earnings (earnings_event_id);
