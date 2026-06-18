-- ============================================================================
-- THUL-NURAYN v1 — 001_seed  (OR-3 provisioning seed)
-- ============================================================================
-- Required baseline data for a PostgreSQL-backed deployment:
--   * one Operator user (referenced by OPERATOR_USER_ID at the entrypoint)
--   * the OR-2 campaign universe (5 sectors, 5 instruments — one symbol/sector)
-- Fixed UUIDs so the seed is deterministic and idempotent (ON CONFLICT DO NOTHING).
-- No strategy/risk/execution data is seeded (those are produced at runtime).
-- ============================================================================

-- Operator user (OPERATOR_USER_ID = 00000000-0000-0000-0000-000000000001).
INSERT INTO users (id, username, role, is_active, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'operator', 'Operator', TRUE,
   '2026-01-05T00:00:00+00')
ON CONFLICT DO NOTHING;

-- Sectors (one per traded symbol — no intra-sector concentration).
INSERT INTO sectors (id, name, created_at) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Semiconductors', '2026-01-05T00:00:00+00'),
  ('10000000-0000-0000-0000-000000000002', 'Hardware',       '2026-01-05T00:00:00+00'),
  ('10000000-0000-0000-0000-000000000003', 'Software',       '2026-01-05T00:00:00+00'),
  ('10000000-0000-0000-0000-000000000004', 'ConsumerDisc',   '2026-01-05T00:00:00+00'),
  ('10000000-0000-0000-0000-000000000005', 'AutoEV',         '2026-01-05T00:00:00+00')
ON CONFLICT DO NOTHING;

-- Instruments (the OR-2 campaign universe).
INSERT INTO instruments (id, symbol, market, sector_id, is_active, created_at) VALUES
  ('20000000-0000-0000-0000-000000000001', 'NVDA', 'NASDAQ',
   '10000000-0000-0000-0000-000000000001', TRUE, '2026-01-05T00:00:00+00'),
  ('20000000-0000-0000-0000-000000000002', 'AAPL', 'NASDAQ',
   '10000000-0000-0000-0000-000000000002', TRUE, '2026-01-05T00:00:00+00'),
  ('20000000-0000-0000-0000-000000000003', 'MSFT', 'NASDAQ',
   '10000000-0000-0000-0000-000000000003', TRUE, '2026-01-05T00:00:00+00'),
  ('20000000-0000-0000-0000-000000000004', 'AMZN', 'NASDAQ',
   '10000000-0000-0000-0000-000000000004', TRUE, '2026-01-05T00:00:00+00'),
  ('20000000-0000-0000-0000-000000000005', 'TSLA', 'NASDAQ',
   '10000000-0000-0000-0000-000000000005', TRUE, '2026-01-05T00:00:00+00')
ON CONFLICT DO NOTHING;
