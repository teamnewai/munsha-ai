# THUL-NURAYN v1 — D1 FOUNDATION REPORT

- **Phase:** D1 — Foundation (FROZEN scope, foundation only)
- **Date:** 2026-06-09
- **Stack:** Python 3.11 (pure-stdlib core) + PostgreSQL (source of truth) + Redis (operational)
- **Status:** ✅ Complete — **STOP** (awaiting review/approval before D2)

> ⚠️ **Critical precondition (see §12 and `docs/CHANGE_REQUESTS/CR-001.md`):**
> the authoritative `THUL-NURAYN_v1_MASTER_SPECIFICATION.md` and the
> referenced **Phase 4A / 4B / 4C** documents were **not present** in this
> repository. D1 was therefore built from the D1 task brief's own
> enumerations, with every undic­tated detail (column shapes, indexes,
> partition keys, enum members, retention windows) implemented as a
> **conservative, explicitly-flagged assumption** for reconciliation when the
> spec arrives.

---

## 1. Repository Structure

THUL-NURAYN is isolated under `thul_nurayn/` so it does not disturb the
pre-existing `monshaati-ai` Next.js application in this repo.

```
docs/
├── THUL-NURAYN_v1_MASTER_SPECIFICATION.md   # DERIVED placeholder (not authoritative)
├── CHANGE_REQUESTS/CR-001.md                # missing-spec change request
└── V2_BACKLOG/V2_BACKLOG.md                 # forbidden-change backlog

thul_nurayn/
├── __init__.py                              # package + version
├── README.md
├── pyproject.toml                           # pytest + coverage config; optional deps
├── requirements-dev.txt
├── config/         settings.py              # Configuration Layer
├── logging/        logger.py                # Logging Layer
├── domain/         enums.py, models.py      # Enums + Core Domain Models
├── validation/     validators.py, errors.py # Validation Layer
├── redis/          keys.py, infrastructure.py# Redis operational layer
├── db/             __init__.py (manifest)
│   └── migrations/ 001..012 *.sql + README  # PostgreSQL = source of truth
└── tests/          test_*.py                # Unit tests (pytest)

D1_FOUNDATION_REPORT.md                      # this report
```

## 2. Database Design Summary

PostgreSQL is the **source of truth**. The schema is defined as 12 ordered,
idempotent migration files and was **validated end-to-end against PostgreSQL
16** (all migrations applied cleanly; objects verified by query).

| Object class            | Count | Notes |
| ----------------------- | ----- | ----- |
| Logical entities        | 19    | all required entities present |
| Base tables (verified)  | 36    | 19 entities + partition children + defaults + `retention_policies` |
| Enum types              | 8     | members identical to `domain/enums.py` |
| Partitioned parents     | 4     | monthly RANGE partitioning |
| Foreign keys            | 29    | see §3 |
| Indexes                 | 100   | incl. PKs, uniques, partials |

- **Numeric precision:** prices `NUMERIC(18,8)`, quantities `NUMERIC(20,8)`,
  money/PnL `NUMERIC(20,8)`, ratios bounded by `CHECK` constraints.
- **Integrity:** OHLC coherence `CHECK` on `market_snapshots`; positive-value
  checks on prices/quantities/tick/lot; period coherence on
  `performance_records`; bounded `sentiment`/`relevance`/`win_rate`.
- **Fail-safe:** `risk_checks.decision` defaults to `'REJECTED'`.

### Partition strategy (verified)

Monthly `RANGE` partitions on the four append-only, high-volume tables that
nothing references by FK:

| Table              | Partition key   | Default partition | Provisioned ahead |
| ------------------ | --------------- | ----------------- | ----------------- |
| `market_snapshots` | `snapshot_time` | yes               | current + 2 mo    |
| `risk_snapshots`   | `snapshot_time` | yes               | current + 2 mo    |
| `audit_logs`       | `created_at`    | yes               | current + 2 mo    |
| `system_events`    | `created_at`    | yes               | current + 2 mo    |

Helpers `tn_create_monthly_partition()` and `tn_ensure_monthly_partitions()`
provision children; a `DEFAULT` partition guarantees inserts never fail.

### Retention & archival (verified)

Data-driven `retention_policies` registry drives `tn_apply_retention()` /
`tn_apply_all_retention()`, which **DETACH** cold partitions and move them to
the `archive` schema (durable history **preserved**, not destroyed). Verified:
a cold `audit_logs` partition was detached, relocated to `archive`, and its
rows remained intact. Default windows: market/risk 24 mo, audit 84 mo (7 y),
system 12 mo. Scheduling is deferred to D8 (Operations).

## 3. Entity Relationship Summary

```
sectors ─1┄N─ instruments ─1┄N─ market_snapshots        (FK SET NULL: sector)
                         ├─1┄N─ scanner_results
                         ├─1┄N─ signals ─1┄1─ scores
                         │              ├─1┄N─ risk_checks
                         │              ├─N┄M─ news_events      (via signal_news)
                         │              └─N┄M─ earnings_events  (via signal_earnings)
                         ├─1┄N─ orders ─1┄N─ fills
                         ├─1┄N─ positions
                         ├─1┄N─ news_events / earnings_events
users ─1┄N─ orders / positions / risk_snapshots / performance_records
signals ─1┄N─ orders                                     (FK SET NULL)
scanner_results ─1┄N─ signals                            (FK SET NULL)
```

- `ON DELETE CASCADE`: instrument→market_snapshots/scanner_results/signals/
  earnings; order→fills; signal→scores/risk_checks; junctions.
- `ON DELETE RESTRICT`: instrument→orders/positions (protect execution history).
- `ON DELETE SET NULL`: sector→instrument; user→orders/positions; signal→orders;
  scanner_result→signals.
- **Portfolio references preserved:** `positions`, `orders`, `fills`,
  `risk_snapshots`, `performance_records` all carry the relationships a
  portfolio layer (D6) will consume.
- `audit_logs.user_id` is a **soft reference** (no FK) because the table is
  partitioned and append-only — standard practice for audit trails.

## 4. Redis Architecture Summary

Redis is the **non-persistent operational layer** (never source of truth).
All keys are namespaced (`tn:<layer>:…`). Six components, all unit-tested via a
dependency-free in-memory backend; a `RedisPyBackend` adapter targets a live
server.

| Component            | Key prefix       | Purpose |
| -------------------- | ---------------- | ------- |
| Cache Layer          | `tn:cache:*`     | read-through cache (TTL) |
| Event Queues         | `tn:events:*`    | fan-in event streams |
| Worker Queues        | `tn:queue:*` (+`:processing`) | reliable jobs (RPOPLPUSH) |
| Dead Letter Queue    | `tn:dlq:*`       | failed-job capture w/ reason |
| Health Keys          | `tn:health:*`    | component heartbeats (TTL) |
| Temporary State      | `tn:state:*`     | transient operational state |

The work-queue lifecycle (`enqueue → reserve → ack | fail→DLQ`) mirrors the
standard reliable-queue pattern so a crashed worker's in-flight job is
recoverable; failures route to the **DLQ** with a reason.

## 5. Core Models Summary

17 persistence-agnostic dataclass models in `domain/models.py`, each with
stable `to_dict`/`from_dict` (UUID→str, datetime→ISO-8601, Decimal→str,
enum→value): `User, Sector, Instrument, MarketSnapshot, ScannerResult, Signal,
Score, RiskCheck, Order, Fill, Position, RiskSnapshot, NewsEvent,
EarningsEvent, PerformanceRecord, AuditLog, SystemEvent`. Plus two junction
records: `SignalNewsLink`, `SignalEarningsLink`. `RiskCheck` defaults to the
fail-safe `REJECTED`.

## 6. Enumerations Summary

8 `str`-backed enums in `domain/enums.py`, with helpers (`values`, `has_value`,
`coerce`) and behavioural properties (`OrderStatus.is_terminal`,
`RiskDecision.allows_execution`). Members are **identical** to the PostgreSQL
enum types (cross-checked against the live DB):

| Enum | Members |
| ---- | ------- |
| `MarketRegime`   | TRENDING_UP, TRENDING_DOWN, RANGE_BOUND, HIGH_VOLATILITY, UNKNOWN |
| `EngineType`     | MOMENTUM, MEAN_REVERSION, BREAKOUT, TREND_FOLLOWING, EVENT_DRIVEN |
| `Direction`      | LONG, SHORT, FLAT |
| `OrderStatus`    | PENDING, SUBMITTED, PARTIALLY_FILLED, FILLED, CANCELLED, REJECTED, EXPIRED |
| `PositionStatus` | OPEN, CLOSING, CLOSED |
| `UserRole`       | ADMIN, TRADER, ANALYST, VIEWER, SYSTEM |
| `RiskDecision`   | APPROVED, REJECTED, ADJUSTED, PENDING |
| `SeverityLevel`  | DEBUG, INFO, WARNING, ERROR, CRITICAL |

## 7. Validation Layer Summary

Dependency-free `Validator` accumulates field-level errors and raises a single
`ValidationError` (fail-safe; nothing silently accepted). Primitives:
`require, max_len, email, symbol, positive, non_negative, in_range, enum,
custom`. Entity validators: user, instrument, signal, order, fill,
market_snapshot (incl. OHLC coherence). **Shape & invariants only — no trading
logic** (out of D1 scope).

## 8. Configuration Layer Summary

`config/settings.py`: environment-driven, immutable (`frozen=True`) dataclasses
grouped into `AppSettings`, `DatabaseSettings`, `RedisSettings`,
`LoggingSettings`. Reads `TN_*` env vars with an optional `.env` overlay
(minimal built-in parser; no dependency). No secrets hard-coded; safe local
defaults. Derived helpers: `database.dsn`, `redis.url`, `is_production`.
Process-wide cached via `get_settings()`.

## 9. Logging Layer Summary

`logging/logger.py`: structured **JSON** logging on the stdlib `logging`
module (no dependency; package name does not shadow stdlib). `JsonFormatter`
emits `{ts, level, service, logger, message, …extra}`; `BoundLogger` carries
persistent context (`.bind(...)`) and maps to `SeverityLevel`. Idempotent
`configure_logging()`. Non-serializable extras are stringified safely.

## 10. Test Results

```
58 passed in ~0.55s   (pytest 9.0.3, Python 3.11.15)
```

| Suite                  | Focus |
| ---------------------- | ----- |
| `test_enums.py`        | 8 enums, helpers, terminal/exec-gate behaviour |
| `test_models.py`       | 17 models, serialization round-trip, fail-safe default |
| `test_validation.py`   | primitives + 6 entity validators, OHLC coherence |
| `test_redis.py`        | key schema + all 6 components incl. DLQ + TTL |
| `test_config.py`       | defaults, env override, .env overlay, DSN |
| `test_logging.py`      | JSON shape, bound context, severity, idempotency |
| `test_db_migrations.py`| structural: 19 entities, 8 enums, 4 partitioned, retention |

**Plus live DB validation (manual):** all 12 migrations applied on PostgreSQL
16; 19 entities / 8 enum types / 4 partitioned parents / 29 FKs / 100 indexes
verified; retention detach→archive exercised with row preservation.

## 11. Coverage Report

Source-only coverage (excludes test files): **95%** (853 stmts, 46 missed).

| Module | Cover |
| ------ | ----- |
| `domain/enums.py` | 100% |
| `domain/models.py` | 99% |
| `validation/*` | 85–100% |
| `config/settings.py` | 99% |
| `logging/logger.py` | 94% |
| `redis/keys.py` | 100% |
| `redis/infrastructure.py` | 91% |

Uncovered lines are predominantly the **live `RedisPyBackend` adapter** (needs
a running Redis server) and defensive branches — acceptable for a foundation
whose tests run without external services.

## 12. Issues Found

1. **[BLOCKER → mitigated] Missing authoritative specification.** The
   `MASTER_SPECIFICATION` and Phase 4A/4B/4C documents are absent (CR-001).
   D1 proceeded on documented assumptions; **must be reconciled** when the
   spec is supplied.
2. **Assumption register (reconcile against Phase 4A):**
   - Enum **members** of all 8 enums.
   - Exact **column** set/types/nullability/defaults for every entity.
   - **Index** selection and composite ordering.
   - **Partition** key/granularity (monthly) and which 4 tables are partitioned.
   - **Retention** windows (24/24/84/12 months) and archive-vs-drop policy.
   - Relationship **`ON DELETE`** behaviours and the `audit_logs.user_id`
     soft-reference choice.
3. **Domain mismatch:** THUL-NURAYN (trading) lives in the `monshaati-ai`
   (business-ops) repo. Isolated under `thul_nurayn/`; confirm this is the
   intended repository.
4. **Stack chosen as Python** (no spec directive); the existing app is
   TypeScript/Next.js. Confirm Python is acceptable for the trading backend.

## 13. Recommendations

1. **Supply the authoritative spec + Phase 4A/4B/4C** and run a reconciliation
   pass (treat divergences as v1 bug fixes per the FROZEN rules).
2. **Confirm repo + stack** decisions (#3, #4 above) before D2.
3. Add `redis` + `psycopg` and a thin **repository layer** in D2 to bind the
   domain models to the verified schema.
4. Wire the retention functions to a scheduler (`pg_cron`/external) in **D8**.
5. Add CI to run `pytest` + apply migrations against an ephemeral Postgres on
   every PR.

---

## Validation Checklist

| Item | Status |
| ---- | ------ |
| Phase 4A compliance | ⚠️ N/A — spec absent (CR-001); built on documented assumptions |
| Phase 4B compliance | ⚠️ N/A — spec absent (CR-001) |
| Phase 4C compliance | ⚠️ N/A — spec absent (CR-001) |
| Master Specification compliance | ⚠️ N/A — spec absent (CR-001) |
| `fills` implemented | ✅ table + model + validator + FK + index |
| `system_events` implemented | ✅ partitioned table + model |
| Portfolio references preserved | ✅ positions/orders/fills/risk_snapshots/performance |
| DLQ implemented | ✅ `tn:dlq:*` + WorkQueue.fail routing (tested) |
| Fail-safe assumptions preserved | ✅ RiskCheck/`risk_checks` default REJECTED |
| PostgreSQL is Source of Truth | ✅ canonical schema in `db/migrations` |
| Redis non-persistent operational layer | ✅ cache/queue/dlq/health/state only |

## STOP

D1 is complete. **Stopping per the STOP RULE** — D2–D9 are **not** started.
Awaiting review and approval (and ideally the authoritative specification for
reconciliation).
