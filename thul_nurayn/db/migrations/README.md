# THUL-NURAYN v1 — Database Migrations

PostgreSQL is the **source of truth**. These ordered SQL files are the
canonical schema definition for the D1 foundation. Apply them in lexical
order:

| #   | File                              | Contents |
| --- | --------------------------------- | -------- |
| 001 | `001_extensions_and_enums.sql`    | `pgcrypto`; 8 enum types |
| 002 | `002_reference_entities.sql`      | `users`, `sectors`, `instruments` |
| 003 | `003_market_data.sql`             | `market_snapshots` (partitioned), `scanner_results` |
| 004 | `004_signals_scoring.sql`         | `signals`, `scores`, `risk_checks` |
| 005 | `005_execution.sql`               | `orders`, `fills`, `positions` |
| 006 | `006_risk_portfolio.sql`          | `risk_snapshots` (partitioned), `performance_records` |
| 007 | `007_intelligence.sql`            | `news_events`, `earnings_events` |
| 008 | `008_operations.sql`              | `audit_logs` (partitioned), `system_events` (partitioned) |
| 009 | `009_junctions.sql`               | `signal_news`, `signal_earnings` |
| 010 | `010_indexes.sql`                 | All indexes |
| 011 | `011_partitions.sql`              | Partition helpers + initial monthly partitions |
| 012 | `012_retention_archival.sql`      | Retention policy registry + archival functions |

## Apply

```bash
for f in $(ls thul_nurayn/db/migrations/*.sql | sort); do
  psql "$TN_DSN" -v ON_ERROR_STOP=1 -f "$f"
done
```

(Requires PostgreSQL ≥ 12 for partitioning + FK-to-partition semantics.)

## Partition strategy

Monthly `RANGE` partitions on the four append-only, high-volume tables:
`market_snapshots`, `risk_snapshots` (by `snapshot_time`); `audit_logs`,
`system_events` (by `created_at`). Each has a `DEFAULT` catch-all partition;
`tn_ensure_monthly_partitions(parent, from_month, n)` provisions ahead.

## Retention / archival

`retention_policies` drives `tn_apply_retention(parent)` /
`tn_apply_all_retention()`, which **DETACH** cold partitions and move them to
the `archive` schema (preserving durable history). Scheduling is a D8
(Operations) concern and is intentionally not wired up in D1.

> ASSUMPTION FLAG (CR-001): column shapes, indexes, partition keys, and
> retention windows are conservative reconstructions pending the authoritative
> Phase 4A specification.
