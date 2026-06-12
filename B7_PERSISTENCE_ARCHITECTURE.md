# B7_PERSISTENCE_ARCHITECTURE

**Type:** Pre-implementation architecture review. **No code. No tests. No source changes. No schema changes.**
**Derived from:** Master Specification · `PROJECT_STATE_CHECKPOINT_B6.md` · Approved B1–B6 implementation.
**Resume point:** `PROJECT_STATE_CHECKPOINT_B6.md` @ `c9af52b` · 194/194 tests passing.
**Status:** Architecture only — implementation forbidden until owner approval.

---

## 1. Purpose

B7 provides the concrete production persistence layer for THUL-NURAYN v1. It:

- Implements `PostgresRepository[T]` as a concrete, production-ready realization of the D2 `Repository[T]` ABC, replacing `InMemoryRepository` for production use while leaving `InMemoryRepository` fully intact for all existing and future unit tests.
- Provides `PostgresDataAccessLayer`, a subclass of the D2 `DataAccessLayer` that wires all 19 entity repositories as `PostgresRepository` instances and overrides the transaction boundary to use real database transactions.
- Applies the **frozen D1 schema** (`db/migrations/001_init_schema.sql` + `db/partitions/partition_retention.sql`) to a real PostgreSQL instance — no schema changes.
- Fills in the `src/redis/` placeholder with a real ephemeral-state client module.
- Provides environment-based connection configuration (no secrets in code or version control).

B7 adds no domain logic. It is infrastructure plumbing behind the existing D2 abstraction.

---

## 2. Scope

**B7 IS in scope:**

- `PostgresRepository[T]` — all 7 D2 `Repository` operations against PostgreSQL.
- `PostgresBridgeRepository` — composite-key persistence for `SignalNews` and `SignalEarnings`.
- `PostgresDataAccessLayer` — 19 repos wired as `PostgresRepository`; overrides `transaction()` for real DB transactions; inherits all D2 structural lookups unchanged.
- `ConnectionPool` — synchronous PostgreSQL connection pool; env-based config; health check on init.
- Entity serialization — mapping D1 dataclass fields to SQL columns and back (UUID, Decimal, datetime, enum str, bool, int, Optional, dict/JSONB).
- Schema application tooling — a runnable script or Makefile target that applies the frozen D1 SQL files to a target PostgreSQL instance.
- Redis client module — fills in the `src/redis/` placeholder; synchronous client; env-based config; non-fatal failure model.
- B7-specific integration tests (require a running PostgreSQL test instance).

**B7 is NOT in scope (explicitly forbidden):**

- Any new SQL tables, columns, constraints, or indexes.
- Any modification to `db/migrations/001_init_schema.sql` or `db/partitions/partition_retention.sql`.
- Any modification to D1 (`src/enums/`, `src/models/`) or D2 (`src/data_access/`).
- Any modification to D3 (`src/selection/`), D4 (`src/risk/`), D5 (`src/execution/`), or D6 (`src/portfolio/`).
- Broker connectivity, market-data feeds, order routing (D7, owner-gated).
- Risk decisions, execution logic, portfolio analytics, scoring, or selection logic.
- API / FastAPI / WebSocket / UI.
- Position sizing (V2-001).
- ORM frameworks (SQLAlchemy, Django ORM, Tortoise, etc.).
- Async/await interface (the D2 `Repository` ABC is synchronous; async upgrade is a V2 concern).

---

## 3. Responsibilities

**B7 IS allowed to:**

- Implement `PostgresRepository[T]` (concrete, synchronous, no new ABC).
- Implement `PostgresDataAccessLayer` (subclass, no D2 modification).
- Define `ConnectionPool` with env-based config and startup health check.
- Define entity serialization helpers (D1 dataclass → SQL row, SQL row → D1 dataclass).
- Apply the frozen D1 schema to PostgreSQL via a non-destructive script.
- Implement Redis client module (`src/redis/`) with connection, `ping()`, and basic get/set for ephemeral state; non-fatal on connection failure.
- Write B7 integration tests covering all repository operations, transaction rollback, append-only enforcement, unique constraint enforcement, and connection failure fail-safe.

**B7 is FORBIDDEN to:**

- Make or enforce risk decisions (D4).
- Run order/position state machines or send orders (D5).
- Compute portfolio state, PnL, or snapshots (D6).
- Introduce new persisted entities, tables, or enums.
- Change the schema in any way.
- Store secrets, passwords, or connection strings in code or version control.

---

## 4. Persistence Architecture

### 4.1 Design Principle

`PostgresRepository[T]` is a drop-in replacement for `InMemoryRepository[T]` behind the `Repository[T]` ABC. Callers (D2 structural lookups, D5 `AuditEventFlow`, D6 `persist_stats`, future B9 wiring) interact only with the ABC — they are unaware of whether the backend is in-memory or PostgreSQL.

### 4.2 Module Layout

```
src/persistence/__init__.py          — package exports
src/persistence/connection.py        — ConnectionPool (PostgreSQL, synchronous)
src/persistence/serialization.py     — entity ↔ SQL row mapping helpers
src/persistence/repository.py        — PostgresRepository[T] + PostgresBridgeRepository
src/persistence/dal.py               — PostgresDataAccessLayer
src/redis/__init__.py                — Redis client (replaces B1 placeholder)
```

D1, D2, D3, D4, D5, D6 source files are **not touched**.

### 4.3 PostgresRepository[T]

Implements all 7 `Repository[T]` abstract methods plus the `_snapshot()/_restore()` convention:

| Operation | Implementation |
|-----------|---------------|
| `add(entity)` | `INSERT INTO <table> (...) VALUES (...)` — raises `DuplicateEntity` on `UniqueViolation` from DB |
| `get(entity_id)` | `SELECT * FROM <table> WHERE id = $1` — raises `EntityNotFound` if no row |
| `get_or_none(entity_id)` | Same query; returns `None` if no row |
| `list(**filters)` | `SELECT * FROM <table> WHERE field1 = $1 AND ...` — empty filter = full scan |
| `update(entity)` | `UPDATE <table> SET ... WHERE id = $1` — raises `ImmutableViolation` if `append_only=True`; raises `EntityNotFound` if no row |
| `delete(entity_id)` | `DELETE FROM <table> WHERE id = $1` — raises `ImmutableViolation` if `append_only=True`; raises `EntityNotFound` if no row |
| `count(**filters)` | `SELECT COUNT(*) FROM <table> WHERE ...` |
| `_snapshot()` | No-op (returns `None`); DB transaction in `PostgresDataAccessLayer.transaction()` handles rollback |
| `_restore(snap)` | No-op; see above |

Constructor parameters mirror `InMemoryRepository`: `entity_type`, `id_attr`, `unique_fields`, `append_only`. These drive runtime behavior identically to the in-memory implementation.

### 4.4 PostgresBridgeRepository

Parallel to `InMemoryRepository`'s `BridgeRepository` for `SignalNews` and `SignalEarnings`. Composite-key `INSERT`/`SELECT`/`DELETE` against `signal_news` and `signal_earnings` tables. The `_snapshot()`/`_restore()` convention applies identically (no-ops; DB transaction handles rollback).

### 4.5 Entity Serialization

All D1 entities are plain dataclasses. The serialization layer maps field types bidirectionally:

| Python type | PostgreSQL column type | Notes |
|-------------|----------------------|-------|
| `UUID` | `uuid` | Direct mapping via psycopg2 UUID adapter |
| `Decimal` | `numeric` | `psycopg2.extras` decimal adapter; preserves precision |
| `datetime` (tz-aware UTC) | `timestamptz` | Stored and returned as UTC |
| `str` (enum value) | `text` + CHECK | Stored verbatim; CHECK constraint matches D1 enum `.value` spelling |
| `bool` | `boolean` | Direct |
| `int` | `integer` | Direct |
| `Optional[X]` | nullable column | `None` ↔ SQL `NULL` |
| `dict` (`Score.breakdown`) | `jsonb` | JSON serialization/deserialization |

Column names in all 19 tables match D1 entity field names exactly (confirmed by B1 schema review), requiring no name-mapping layer.

### 4.6 Partitioned Tables

Six tables are declared `PARTITION BY RANGE`: `signals`, `orders`, `audit_logs`, `system_events`, `market_snapshots`, `risk_snapshots`. Their PKs are composite `(id, captured_at)` or `(id, created_at)`.

- **INSERT**: routed to the correct monthly partition by PostgreSQL automatically; `PostgresRepository.add()` inserts into the parent table name.
- **SELECT by UUID only** (`get`, `get_or_none`): executed against the parent table; PostgreSQL performs partition pruning where possible. This is slightly less efficient than including the partition key but is the only option when only the UUID is available — consistent with how `InMemoryRepository` operates.
- **SELECT with `created_at` / `captured_at` filter** (`list(created_at=...)`): partition-pruning applies automatically.
- **No schema changes required** to support these query patterns.

### 4.7 Append-Only Enforcement (audit_logs, system_events)

`PostgresRepository` raises `ImmutableViolation` on `update()` and `delete()` when `append_only=True` — identical behavior to `InMemoryRepository`. This is enforced at the Python layer before any SQL is executed. The DB has no separate trigger; the enforcement is at D2 / B7 Python layer (consistent with D2 design).

### 4.8 Unique Field Enforcement

DB-level `UNIQUE` constraints (already present in the frozen D1 schema: e.g. `sectors.name UNIQUE`, `users.username UNIQUE`, `scores.signal_id UNIQUE`, `risk_checks.signal_id UNIQUE`) are the primary enforcement mechanism. `PostgresRepository.add()` and `update()` catch `psycopg2.errors.UniqueViolation` and re-raise as D2 `DuplicateEntity`. The `unique_fields` constructor parameter continues to drive which fields are considered unique, consistent with `InMemoryRepository`.

### 4.9 PostgresDataAccessLayer

Subclasses `DataAccessLayer`. Does **not** call `super().__init__()` (which would wastefully create 19 `InMemoryRepository` instances). Instead:

1. Sets the same 19 named attributes (`self.sectors`, `self.users`, …) as `DataAccessLayer`, but wired with `PostgresRepository` instances.
2. Sets the same 2 bridge attributes (`self.signal_news`, `self.signal_earnings`) with `PostgresBridgeRepository` instances.
3. Rebuilds the `_repositories` dict with the same keys.
4. All 8 structural lookup methods (`fills_for_order`, `fills_for_position`, etc.) are **inherited unchanged** from `DataAccessLayer` — they call `self.<repo>.list(...)` which routes to `PostgresRepository`.
5. **Overrides `transaction()`** to use a real database transaction (see §6.2).

---

## 5. Infrastructure Architecture

### 5.1 PostgreSQL Connection Pool

- **Module:** `src/persistence/connection.py`
- **Driver:** `psycopg2` (synchronous; widely supported; no async complexity needed at v1 with synchronous `Repository` ABC)
- **Pool type:** `psycopg2.pool.ThreadedConnectionPool` (thread-safe; appropriate for synchronous workers)
- **Configuration (environment variables):**

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Full PostgreSQL DSN | `postgresql://user:pass@localhost:5432/thul_nurayn` |
| `DB_POOL_MIN` | Minimum pool connections | `2` |
| `DB_POOL_MAX` | Maximum pool connections | `10` |

- **Startup health check:** `ConnectionPool.__init__()` acquires and immediately releases one connection; raises `PersistenceError` if the DB is unreachable. The application cannot start in production mode with a broken DB connection — fail-safe.
- **No secrets in code or version control.** `DATABASE_URL` must be set via environment or a secrets manager (vault, etc.) that injects env vars at runtime.

### 5.2 Redis Client

- **Module:** `src/redis/__init__.py` (fills in the B1 placeholder)
- **Client:** `redis-py` (synchronous; matches synchronous architecture)
- **Configuration:**

| Variable | Description | Example |
|----------|-------------|---------|
| `REDIS_URL` | Redis DSN | `redis://localhost:6379/0` |
| `REDIS_TIMEOUT_SEC` | Socket timeout | `2` |

- **Non-fatal failure model:** Redis is ephemeral state only — it is NOT a source of truth. A Redis connection failure raises a logged warning but does not prevent the application from functioning. Any feature that requires Redis (e.g. DLQ rate limiting, kill-switch cache in B8) must gracefully degrade to the PostgreSQL-backed fallback.
- **Operations exposed:** `ping()`, `get(key)`, `set(key, value, ex=None)`, `delete(key)`, `close()`. Nothing beyond these primitives belongs in B7; richer Redis usage is B8/D8.

### 5.3 Schema Application

The frozen D1 schema exists in:
- `db/migrations/001_init_schema.sql` — 19 tables, constraints, indexes
- `db/partitions/partition_retention.sql` — monthly partition declarations and retention notes

B7 provides a lightweight schema-application mechanism (a Python script or Makefile target) that:
1. Connects to the target PostgreSQL instance via `DATABASE_URL`.
2. Executes both SQL files in order within a single transaction.
3. Is **idempotent for a fresh database**; for an already-initialized database, the operator is responsible for confirming no conflicting objects exist (no `IF NOT EXISTS` guards are added to the frozen SQL files — the files are not modified).

This mechanism is used in CI/CD to provision test databases and in production for initial deployment. It is not an ORM migration framework.

---

## 6. Recovery & Restart Model

### 6.1 Source of Truth

PostgreSQL is the sole source of truth for all persisted D1 entities. Redis is ephemeral and is never treated as authoritative. On any restart:

- **Persisted entities** (positions, orders, fills, signals, risk_checks, etc.) are fully recoverable from PostgreSQL — no data loss.
- **Transient aggregates** (B6 `PortfolioState`, D5 `DuplicateOrderProtection` fingerprint set, D4 `RiskState`) are in-memory and must be rebuilt from the DB. The rebuild procedure is B9 (Integration) responsibility; B7 provides the persistence layer that makes it possible.

### 6.2 Transaction Boundary

`PostgresDataAccessLayer.transaction()` overrides the D2 snapshot/restore pattern:

```
transaction() behavior:
  1. Acquire a dedicated connection from the pool.
  2. Store it in thread-local storage so all PostgresRepository instances
     within this DAL use the same connection.
  3. Execute BEGIN (or use the connection's autocommit=False default).
  4. yield self  ← caller executes work.
  5. On clean exit: COMMIT; release connection.
  6. On exception: ROLLBACK; release connection; re-raise.
```

This replaces the D2 in-memory snapshot/restore. `PostgresRepository._snapshot()` and `_restore()` are no-ops because the DB transaction handles atomicity. The external interface (`with dal.transaction() as dal:`) is identical to D2's — callers require no changes.

### 6.3 Transient State Rebuild (Post-Restart — B9 Wiring)

| Transient State | Source of Rebuild | Owner |
|-----------------|-------------------|-------|
| B6 `PortfolioState` | All `positions` (OPEN) + `fills` + config `starting_capital` | B9 |
| D5 `DuplicateOrderProtection` | All `orders` with `status IN ('New','Sent')` | B9 |
| D4 `RiskState` counters | `orders` (today), `risk_checks`, `positions` (open) | B9 |
| Kill switch level | Latest `KillSwitchActivated` in `system_events` | B8/B9 |

B7 provides the data access layer that makes this rebuild feasible. The rebuild logic itself is not B7's scope.

### 6.4 Redis Recovery

Redis state is deliberately ephemeral. On restart:
- Redis is flushed or treated as cold.
- Any state cached in Redis is either rebuilt from PostgreSQL on first access or is non-critical (rate-limit counters, etc.).
- B8 operations layer manages the Redis warming procedure.

---

## 7. State Persistence Strategy

| Entity / Object | Backend | Persistence |
|-----------------|---------|-------------|
| All 17 D1 entity types | `PostgresRepository[T]` | Full CRUD against their D1 tables |
| `SignalNews`, `SignalEarnings` (bridges) | `PostgresBridgeRepository` | Composite-key INSERT/SELECT/DELETE |
| B6 `AccountState` | None | Transient; computed from `starting_capital` config + realized PnL from `positions` |
| B6 `PortfolioState` | None | Transient aggregate; rebuilt from DB on restart (B9) |
| B6 `PortfolioSnapshot` | None | Transient read model; recomputed on demand |
| B6 `PeriodStats` data | `performance_records` | Written via `PortfolioState.persist_stats(stats, dal)` — already works; B7 makes it write to PostgreSQL |
| D5 audit events | `audit_logs` (append-only) | Written by `AuditEventFlow`; B7 makes it durable |
| System events | `system_events` (append-only) | Written by B8 operations; B7 makes it durable |
| Kill switch level | `system_events` + Redis cache | Appended to `system_events` on change; cached in Redis for fast reads (B8) |
| DLQ entries | Future B8 table / Redis | Out of B7 scope |

**No new `accounts`, `portfolio`, `portfolio_state`, or `kill_switch` tables.** The frozen 19-table schema is sufficient.

---

## 8. Audit & Logging Persistence

`audit_logs` and `system_events` are append-only in both D2 and B7:

- `PostgresRepository` with `append_only=True` raises `ImmutableViolation` on `update()` and `delete()` at the Python layer — identical to `InMemoryRepository`.
- Both tables are partitioned (monthly RANGE on `created_at`); `PostgresRepository.add()` inserts into the parent table and PostgreSQL routes to the correct partition.
- `AuditEventFlow` (D5) writes to `dal.audit_logs.add(...)` — no D5 changes; the call now routes to `PostgresRepository` when the `PostgresDataAccessLayer` is wired.
- System events (kill switch activations, service start/stop, worker failures) are written by B8; B7 provides the durable store.
- Both tables are indexed on `event_type` and `created_at` (schema already has these indexes from B1).

---

## 9. Dependency Graph

```
  ┌─────────────────────────────────────────────────────────────┐
  │               THUL-NURAYN v1 Layer Model                    │
  ├─────────────────────────────────────────────────────────────┤
  │ B9 Integration / E2E              (depends on D1–D8)        │
  │ B8 Operations & Monitoring        (depends on D1–D7)        │
  │ D7 Broker Adapters (owner-gated)  (depends on D1–D5)        │
  ├─────────────────────────────────────────────────────────────┤
  │ D6 Portfolio & State              (depends on D1, D2, D5)   │
  │ D5 Execution Domain               (depends on D1, D2)       │
  │ D4 Risk Gate                      (depends on D1)           │
  │ D3 Selection Engine               (depends on D1)           │
  ├─────────────────────────────────────────────────────────────┤
  │ B7 Persistence & Infrastructure ◄── THIS PHASE              │
  │   src/persistence/  →  PostgresRepository / DAL             │
  │   src/redis/        →  Redis ephemeral client               │
  │   db/ (frozen)      →  applied to real PostgreSQL           │
  ├─────────────────────────────────────────────────────────────┤
  │ D2 Data Access Layer  (Repository ABC, InMemoryRepository,  │
  │                         DataAccessLayer, error hierarchy)    │
  │ D1 Foundation         (enums, models, schema SQL)           │
  └─────────────────────────────────────────────────────────────┘
```

**B7 depends on:** D1 (entities/enums for serialization) · D2 (Repository ABC, DataAccessLayer base, error hierarchy)

**B7 provides to:** D3/D4/D5/D6 (indirectly, by wiring the DAL with a durable backend) · D8 Operations (Redis client; durable `system_events`) · D9 UI · B9 Integration (startup state rebuild)

**B7 does not depend on D3, D4, D5, or D6.** No circular dependencies.

---

## 10. Fail-Safe Rules

| Condition | Behavior |
|-----------|----------|
| PostgreSQL unreachable at startup | Raise `PersistenceError` in `ConnectionPool.__init__()` — application cannot start |
| PostgreSQL connection lost mid-operation | Exception propagates to caller → upstream Fail-Safe / DLQ; no silent swallow |
| DB query error (constraint violation, etc.) | Mapped to D2 errors (`DuplicateEntity`, `EntityNotFound`) or re-raised as `PersistenceError`; never swallowed |
| Transaction exception | ROLLBACK + re-raise; atomicity guaranteed |
| `update()`/`delete()` on append-only repo | `ImmutableViolation` raised before SQL execution |
| Schema missing at startup | Health check fails; `PersistenceError` raised; startup aborted |
| Redis unreachable at startup | Log WARNING; continue in degraded mode (Redis-dependent features unavailable) |
| Redis operation failure | Log WARNING; return `None` or raise to caller depending on operation context; never fatal |
| Serialization error (unexpected type) | `PersistenceError` raised; operation aborted; no partial write |
| No automatic retry | Consistent with Master Spec Fail-Safe principle and D5/B5 precedent; DLQ routing is B8 |

---

## 11. Out of Scope

The following are explicitly out of scope for B7:

- Any new SQL table, column, index, or constraint.
- Any modification to the 19-table D1 schema.
- ORM frameworks (SQLAlchemy, Django ORM, Tortoise ORM, Alembic, etc.).
- Async/await (`Repository` ABC is synchronous; async upgrade is V2).
- Broker connectivity or market data (D7, owner-gated).
- Risk decisions or enforcement (D4).
- Order/position state machines (D5).
- Portfolio analytics or snapshot computation (D6).
- Selection engine scoring (D3).
- DLQ persistence (B8 scope).
- Health-check endpoints or alerting (B8 scope).
- Worker/scheduler infrastructure (B8 scope).
- Startup state rebuild (B9 scope).
- API / FastAPI / UI.
- Position sizing (V2-001).

---

## 12. Definition of Done

1. `PostgresRepository[T]` implements all 7 D2 `Repository[T]` operations against a real PostgreSQL instance.
2. `PostgresBridgeRepository` implements composite-key persistence for `SignalNews` and `SignalEarnings`.
3. `PostgresDataAccessLayer` wires all 19 entity repos as `PostgresRepository` and 2 bridge repos as `PostgresBridgeRepository`; inherits all D2 structural lookups unchanged.
4. `PostgresDataAccessLayer.transaction()` overrides D2's snapshot/restore with a real `BEGIN/COMMIT/ROLLBACK` transaction.
5. `ConnectionPool` module: env-based config; startup health check; raises `PersistenceError` if DB is unreachable.
6. `src/redis/__init__.py` operational: `ping()`, `get/set/delete`; non-fatal failure model; env-based config.
7. Schema application script executes `001_init_schema.sql` and `partition_retention.sql` on a target PostgreSQL instance without error.
8. Append-only enforcement (`ImmutableViolation`) works for `audit_logs` and `system_events` in `PostgresRepository`.
9. Unique constraint violations from PostgreSQL mapped to D2 `DuplicateEntity`.
10. `EntityNotFound` raised correctly on `get()` and `delete()` for non-existent ids.
11. All **194 existing tests remain green** — `InMemoryRepository` is unchanged; all prior test suites continue using it.
12. B7 integration tests cover: all 7 CRUD operations; transaction rollback on exception; append-only enforcement; unique violation; `get()` of non-existent id; connection failure fail-safe; Redis degraded mode.
13. No new entities, tables, enums, or schema changes.
14. D1, D2, D3, D4, D5, D6 source files **unmodified**.
15. No secrets in code or version control.
16. `B7_BUILD_REPORT.md` produced; stop at B7 gate.

---

## 13. Stop Gate

**STOP.**

Await owner approval. Implementation is forbidden until approval is granted.
This document is architecture only — no code, no tests, no source/schema changes.

