# B7_ARCHITECTURE_SUMMARY

**Source:** `B7_PERSISTENCE_ARCHITECTURE.md` (commit `bb35b60`).
**Type:** Architecture summary for owner review. No code. No implementation.

---

## 1. Purpose

B7 makes the persistence layer production-ready. It provides a concrete `PostgresRepository[T]` that implements the existing D2 `Repository[T]` ABC, a `PostgresDataAccessLayer` subclass that wires all 19 entity repositories to PostgreSQL, applies the frozen D1 schema to a real PostgreSQL instance, and fills in the Redis ephemeral-state client placeholder from B1. No domain logic is added.

---

## 2. Responsibilities

**Allowed:**

- Implement `PostgresRepository[T]` — all 7 D2 CRUD operations against PostgreSQL.
- Implement `PostgresBridgeRepository` — composite-key persistence for `SignalNews` / `SignalEarnings`.
- Implement `PostgresDataAccessLayer` — subclass of D2 `DataAccessLayer`; wires 19 repos as `PostgresRepository`; overrides `transaction()` for real `BEGIN/COMMIT/ROLLBACK`; all D2 structural lookups inherited unchanged.
- Implement `ConnectionPool` — synchronous psycopg2 pool; env-based config; fail-safe startup health check.
- Implement entity serialization — D1 dataclass ↔ SQL row (UUID, Decimal, datetime, enum str, bool, int, Optional, dict/JSONB).
- Apply frozen D1 schema to PostgreSQL via a non-destructive script.
- Implement Redis client module (fills in `src/redis/` B1 placeholder); non-fatal failure model.

**Forbidden:**

- Any new tables, entities, enums, or schema changes.
- Any modification to D1, D2, D3, D4, D5, or D6.
- Risk decisions, execution logic, portfolio analytics, selection logic.
- Broker connectivity, API, UI, position sizing.
- ORM frameworks (SQLAlchemy, Alembic, etc.).
- Async/await (Repository ABC is synchronous; async is V2).

---

## 3. Persistence Architecture

`PostgresRepository[T]` is a drop-in replacement for `InMemoryRepository[T]` behind the same `Repository[T]` ABC. All callers interact only with the ABC — no caller changes are required.

| Operation | SQL behavior |
|-----------|-------------|
| `add` | `INSERT`; raises `DuplicateEntity` on DB `UniqueViolation` |
| `get` | `SELECT … WHERE id = $1`; raises `EntityNotFound` if missing |
| `get_or_none` | Same; returns `None` if missing |
| `list(**filters)` | `SELECT … WHERE field = $1 AND …`; empty filters = full scan |
| `update` | `UPDATE`; raises `ImmutableViolation` if `append_only=True`; raises `EntityNotFound` if missing |
| `delete` | `DELETE`; raises `ImmutableViolation` if `append_only=True`; raises `EntityNotFound` if missing |
| `count` | `SELECT COUNT(*)` |

D1 entity field names match SQL column names exactly — no mapping layer needed. Serialization covers: `UUID` → `uuid`, `Decimal` → `numeric`, `datetime` (UTC) → `timestamptz`, enum `.value` → `text` (matches CHECK constraints), `Optional` → nullable, `dict` → `jsonb`.

Six partitioned tables (`signals`, `orders`, `audit_logs`, `system_events`, `market_snapshots`, `risk_snapshots`): `add()` inserts into the parent table; PostgreSQL routes to the correct partition automatically. `get()` queries the parent by UUID; PostgreSQL scans partitions as needed.

`PostgresDataAccessLayer` subclasses `DataAccessLayer`; does not call `super().__init__()` (avoids creating wasteful InMemoryRepository instances); sets the same 19+2 repo attributes; inherits all structural lookups unchanged.

---

## 4. Infrastructure Architecture

**PostgreSQL:**

- Driver: `psycopg2` (synchronous, to match the synchronous `Repository` ABC).
- Pool: `psycopg2.pool.ThreadedConnectionPool`.
- Config: `DATABASE_URL`, `DB_POOL_MIN`, `DB_POOL_MAX` environment variables. No secrets in code or version control.
- Startup health check: acquires and releases one connection on init; raises `PersistenceError` if the DB is unreachable. The application cannot start with a broken DB.

**Redis:**

- Client: `redis-py` (synchronous).
- Config: `REDIS_URL`, `REDIS_TIMEOUT_SEC` environment variables.
- Exposed operations: `ping()`, `get/set/delete`. No richer Redis usage in B7; that is B8/D8.
- Non-fatal: Redis failure logs a WARNING and continues in degraded mode. Redis is never a source of truth.

**Schema application:**

- A lightweight script (Python or Makefile) executes the two frozen D1 SQL files (`001_init_schema.sql`, `partition_retention.sql`) against the target PostgreSQL instance in a single transaction.
- The SQL files are not modified. No `IF NOT EXISTS` guards added. Intended for fresh-database provisioning.

---

## 5. Recovery Model

PostgreSQL is the sole source of truth. On any restart:

- All persisted D1 entities are fully recoverable from PostgreSQL.
- Redis is ephemeral and is treated as cold on restart.
- Transient in-memory aggregates must be rebuilt from the DB. The rebuild procedure is B9 (Integration) scope, not B7.

| Transient state | Rebuilt from | Owner |
|-----------------|-------------|-------|
| B6 `PortfolioState` | `positions` (OPEN) + `fills` + `starting_capital` config | B9 |
| D5 `DuplicateOrderProtection` fingerprints | `orders` with status `New` or `Sent` | B9 |
| D4 risk counters | `orders` (today), `positions` (open), `risk_checks` | B9 |
| Kill switch level | Latest `KillSwitchActivated` row in `system_events` | B8/B9 |

`PostgresDataAccessLayer.transaction()` overrides D2's snapshot/restore pattern with `BEGIN/COMMIT/ROLLBACK`. `PostgresRepository._snapshot()` and `_restore()` are no-ops; the DB transaction handles atomicity. The external interface (`with dal.transaction() as dal:`) is unchanged.

---

## 6. State Persistence Model

| Object | Persisted | Table | Notes |
|--------|-----------|-------|-------|
| All 17 D1 entity types | Yes | Their existing D1 tables | Full CRUD via `PostgresRepository` |
| `SignalNews`, `SignalEarnings` | Yes | `signal_news`, `signal_earnings` | Composite-key via `PostgresBridgeRepository` |
| B6 `AccountState` | No | — | Transient; computed from config + realized PnL |
| B6 `PortfolioState` | No | — | Transient aggregate; rebuilt from DB (B9) |
| B6 `PortfolioSnapshot` | No | — | Transient read model |
| B6 `PeriodStats` data | Yes | `performance_records` (existing) | Via `PortfolioState.persist_stats()`; no change to call site |
| Kill switch level | Yes | `system_events` (existing, append-only) | Cached in Redis by B8 |
| DLQ entries | Out of B7 | — | B8 scope |

No new `accounts`, `portfolio`, `portfolio_state`, or `kill_switch` tables are introduced. The frozen 19-table schema is sufficient.

---

## 7. Logging and Audit Persistence

- `audit_logs` and `system_events` are append-only in B7 (as in D2): `PostgresRepository` raises `ImmutableViolation` on `update()` / `delete()` at the Python layer before any SQL.
- Both tables are partitioned (monthly RANGE). `add()` inserts into the parent; PostgreSQL routes to the correct partition.
- `AuditEventFlow` (D5) writes to `dal.audit_logs.add(...)` — no D5 change; with `PostgresDataAccessLayer` wired, these writes become durable.
- System events (service start/stop, kill switch changes, worker failures) are written by B8; B7 provides the durable store.
- Both tables are indexed on `event_type`, `severity`, and `created_at` (B1 schema already has these indexes).

---

## 8. Dependencies

**B7 depends on:**
- D1 — entity dataclasses and enum values for serialization.
- D2 — `Repository[T]` ABC, `DataAccessLayer` base class, error hierarchy (`DuplicateEntity`, `EntityNotFound`, `ImmutableViolation`).

**B7 is consumed by:**
- D3/D4/D5/D6 — indirectly (via the DAL they receive at wiring time in B9).
- D8 Operations — Redis client; durable `system_events`.
- D9 UI — read access to persisted data.
- B9 Integration — startup state rebuild; end-to-end wiring.

**B7 does not depend on D3, D4, D5, or D6.** No circular dependencies.

---

## 9. Fail-Safe Rules

| Condition | Response |
|-----------|----------|
| PostgreSQL unreachable at startup | `PersistenceError` raised; application cannot start |
| DB connection lost mid-operation | Exception propagates; no silent swallow |
| DB query error / constraint violation | Mapped to D2 errors or re-raised as `PersistenceError` |
| Transaction exception | ROLLBACK + re-raise; atomicity guaranteed |
| `update()` / `delete()` on append-only repo | `ImmutableViolation` before SQL execution |
| Schema missing (table not found) at startup | Health check fails; `PersistenceError`; startup aborted |
| Redis unreachable at startup | WARNING logged; degraded mode; application continues |
| Redis operation failure | WARNING logged; `None` returned or exception surfaced; never fatal |
| Serialization error | `PersistenceError` raised; no partial write |
| No automatic retry | Consistent with Master Spec Fail-Safe and B5 precedent; DLQ routing is B8 |

---

## 10. Assumptions

1. The D2 `Repository` ABC and `DataAccessLayer` are synchronous. B7 uses a synchronous PostgreSQL driver (`psycopg2`) and synchronous Redis client (`redis-py`). Async upgrade is a V2 concern and would require modifying the D2 ABC.
2. `PostgresDataAccessLayer` subclasses `DataAccessLayer` without calling `super().__init__()`, avoiding creation of 19 wasteful `InMemoryRepository` instances while fully inheriting all structural lookup methods.
3. `PostgresRepository._snapshot()` and `_restore()` are no-ops. The real transaction rollback is managed by `PostgresDataAccessLayer.transaction()` at the DB level.
4. D1 entity field names match SQL column names exactly (confirmed by schema review in B7_PERSISTENCE_ARCHITECTURE §4.5). No name-mapping layer is required.
5. Unique constraints at the DB level (`sectors.name`, `users.username`, `scores.signal_id`, `risk_checks.signal_id`) are the primary enforcement mechanism for uniqueness; `psycopg2.errors.UniqueViolation` is caught and re-raised as `DuplicateEntity`.
6. All existing 194 tests continue using `InMemoryRepository`. `InMemoryRepository` and the D2 codebase are not modified. B7 integration tests require a separate running PostgreSQL instance (Docker or local).
7. Redis failure is non-fatal. Redis is ephemeral and supplementary; PostgreSQL remains the sole source of truth.
8. Schema application is for fresh-database provisioning only. The SQL files are not modified. Production migration (upgrading an existing schema) is out of v1 scope.
9. The six partitioned tables (`signals`, `orders`, `audit_logs`, `system_events`, `market_snapshots`, `risk_snapshots`) are queried by UUID-only when the partition key is unavailable. PostgreSQL spans all partitions in this case — correct but less efficient than providing the partition key. The accepted trade-off for v1.
10. The `src/redis/` placeholder already exists from B1. B7 fills it in; no new package is needed.

---

## 11. New Entities Introduced?

**No.**

`PostgresRepository`, `PostgresBridgeRepository`, `PostgresDataAccessLayer`, and `ConnectionPool` are infrastructure classes, not D1 domain entities. No new dataclasses are added to the D1 model set.

---

## 12. New Tables Introduced?

**No.**

B7 applies the existing 19-table D1 schema to a real PostgreSQL instance. No `CREATE TABLE` statement is added. The frozen schema is sufficient.

---

## 13. New Enums Introduced?

**No.**

B7 adds no enumerations. The 12 D1 enums are unchanged. B7 uses their `.value` strings for SQL serialization.

---

## 14. Schema Changes Required?

**No.**

The frozen D1 schema (`001_init_schema.sql`) requires no modification. B7 applies it as-is. All necessary tables, columns, constraints, indexes, and partitions already exist.

---

## 15. Changes to B1–B6?

**No.**

D1 (`src/enums/`, `src/models/`, `db/`), D2 (`src/data_access/`), D3 (`src/selection/`), D4 (`src/risk/`), D5 (`src/execution/`), and D6 (`src/portfolio/`) source files are **not touched**. The 194 existing tests remain green because `InMemoryRepository` is unchanged and all prior test suites continue using it exclusively.

---

## 16. Out-of-Scope Items

- New SQL tables, columns, indexes, or constraints.
- ORM frameworks (SQLAlchemy, Django ORM, Alembic, etc.).
- Async/await (`Repository` ABC is synchronous; async is V2).
- Broker connectivity / IBKR / market data (D7, owner-gated).
- Risk decisions or enforcement (D4).
- Order/position state machines (D5).
- Portfolio analytics or snapshot computation (D6).
- Selection engine scoring (D3).
- DLQ persistence (B8 scope).
- Health-check HTTP endpoints or alerting (B8 scope).
- Worker/scheduler infrastructure (B8 scope).
- Startup state rebuild for `PortfolioState`, `DuplicateOrderProtection`, `RiskState` (B9 scope).
- Kill switch level caching in Redis (B8 scope).
- API / FastAPI / UI.
- Position sizing (V2-001).

---

## 17. Definition of Done

| # | Criterion |
|---|-----------|
| 1 | `PostgresRepository[T]` — all 7 operations against real PostgreSQL |
| 2 | `PostgresBridgeRepository` — composite-key persistence for bridge tables |
| 3 | `PostgresDataAccessLayer` — 19+2 repos wired; D2 structural lookups inherited |
| 4 | `transaction()` override — real `BEGIN/COMMIT/ROLLBACK`; rollback on exception |
| 5 | `ConnectionPool` — env-based config; fail-safe startup health check |
| 6 | Redis client — `ping/get/set/delete`; env-based config; non-fatal failure |
| 7 | Schema application script — executes D1 SQL files on target PostgreSQL without error |
| 8 | Append-only enforcement — `ImmutableViolation` on `update/delete` for `audit_logs`/`system_events` |
| 9 | Unique violations mapped to `DuplicateEntity` |
| 10 | `EntityNotFound` raised correctly |
| 11 | All **194 existing tests remain green** (InMemoryRepository unchanged) |
| 12 | B7 integration tests: CRUD, rollback, append-only, unique violation, connection fail-safe, Redis degraded mode |
| 13 | No new entities, tables, enums, or schema changes |
| 14 | D1–D6 source files unmodified |
| 15 | No secrets in code or version control |
| 16 | `B7_BUILD_REPORT.md` produced; stop at B7 gate |

---

## 18. Stop Gate

**STOP.**

Awaiting owner review and approval before B7 implementation begins.
This document is architecture summary only — no code, no tests, no source or schema changes.
