# THUL-NURAYN v1 — MASTER SPECIFICATION (WORKING / DERIVED)

> **STATUS: ⚠️ DERIVED PLACEHOLDER — NOT THE AUTHORITATIVE SOURCE OF TRUTH**
>
> The authoritative `THUL-NURAYN_v1_MASTER_SPECIFICATION.md` and the
> referenced **Phase 4A / Phase 4B / Phase 4C** documents were **not present**
> in this repository (or its git history) when the D1 Foundation work began.
>
> This file is a **working specification reconstructed from the D1 task
> brief**. It enumerates the entities, enumerations, models, and
> infrastructure layers the brief lists, and records the **conservative,
> explicitly-flagged assumptions** made for everything the brief does *not*
> pin down (column shapes, indexes, partition keys, enum members,
> retention windows).
>
> **When the authoritative specification is supplied, this file must be
> replaced by it, and the D1 implementation reconciled against it.** Any
> divergence is tracked in `D1_FOUNDATION_REPORT.md` → "Issues Found" and,
> where appropriate, as Change Requests under `docs/CHANGE_REQUESTS/`.

---

## 1. Project Status

THUL-NURAYN v1 is **FROZEN**.

| Allowed in v1            | Forbidden in v1 (→ V2_BACKLOG) |
| ------------------------ | ------------------------------ |
| Bug fixes                | Strategy changes               |
| Clarifications           | Risk changes                   |
| Documentation corrections| Score changes                  |
|                          | Execution-rule changes         |
|                          | Architecture changes           |
|                          | Database-design changes        |
|                          | API-contract changes           |
|                          | New indicators                 |
|                          | New trading logic              |
|                          | New risk rules                 |

Any strategic modification must be **rejected** and recorded as a
`V2_BACKLOG_ITEM` in `docs/V2_BACKLOG/V2_BACKLOG.md`.

## 2. Architectural Invariants (preserved by D1)

- **PostgreSQL is the Source of Truth.** All durable state lives in Postgres.
- **Redis is a non-persistent operational layer.** Cache, queues, DLQ,
  health, and transient state only — never the system of record.
- **Fail-safe assumptions are preserved.** Risk decisions default to the
  most conservative outcome; absence of an explicit approval is treated as
  not-approved.
- **`fills`, `system_events`, DLQ, and portfolio references are first-class**
  and must exist in the foundation.

## 3. Domain Entities (19)

`users`, `sectors`, `instruments`, `market_snapshots`, `scanner_results`,
`signals`, `scores`, `risk_checks`, `orders`, `fills`, `positions`,
`risk_snapshots`, `news_events`, `earnings_events`, `performance_records`,
`audit_logs`, `system_events`, `signal_news`, `signal_earnings`.

See `thul_nurayn/db/migrations/` for the canonical PostgreSQL DDL and
`thul_nurayn/domain/models.py` for the Core Domain Models.

## 4. Shared Enumerations (8)

`MarketRegime`, `EngineType`, `Direction`, `OrderStatus`, `PositionStatus`,
`UserRole`, `RiskDecision`, `SeverityLevel`. See `thul_nurayn/domain/enums.py`.

> **Assumption flag:** Enum *members* are reconstructed conservatively and
> are subject to replacement by the authoritative spec.

## 5. D1 Scope (Foundation Only)

**In scope:** repository structure, PostgreSQL schema (entities,
relationships, indexes, partitioning, retention/archival), Redis
infrastructure, Core Domain Models, Shared Enums, Validation Layer,
Configuration Layer, Logging Layer, Unit Tests, Technical Documentation.

**Explicitly OUT of scope for D1** (deferred to later phases D2–D9):
Scanner Logic, Ranking Logic, Score Engine Logic, Risk Engine Logic,
Execution Engine Logic, Portfolio Logic, TradingView Integration,
Interactive Brokers Integration, Dashboard, News Engine, Monitoring Engine.

No trading / risk / scoring **logic** is implemented in D1 — only the
data structures and infrastructure those engines will later use.
