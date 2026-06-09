# IMPLEMENTATION_RESET_REPORT

**Project:** THUL-NURAYN v1 — US-equities algorithmic trading backend (NASDAQ/NYSE, Long/Short; Core Swing + Turbo Intraday)
**Status basis:** Architecture **complete & FROZEN**; implementation **not started**.
**Source of truth:** The approved documentation pack (MASTER_SPECIFICATION + CLAUDE.md + D1–D9 reports + IMPLEMENTATION_PLAN). No pre-existing code is assumed.
**Date:** 2026-06-09
**Constraint:** Planning document only. No code. Stop after delivery.

---

## 1. Actual Project State

| Dimension | State |
|-----------|-------|
| **Strategy & rules** | ✅ Complete, frozen. 20-section Master Spec governs. Thresholds, weights, classifications, risk limits, execution logic all defined. |
| **Domain architecture (D1–D9)** | ✅ Complete as design/specification. D1–D6 are *specified* (not coded); D7–D9 are architecture/contracts/UX only. |
| **Implemented code** | ❌ **None.** No repository, no source, no migrations, no tests exist yet. |
| **Tests** | ❌ **None.** (The pack's "91 unit tests, D2–D6" describe the *target* a correct D1–D6 implementation must reach — they are an acceptance baseline to be *rebuilt*, not an existing asset.) |
| **Infrastructure** | ❌ Not provisioned (no PostgreSQL/Redis/Docker/VPS, no broker). |
| **Frozen policy** | 🔒 Active. Allowed: Bug Fixes · Clarifications · Documentation Corrections. Any strategic change → V2_BACKLOG + stop. |

**Correction recorded:** Earlier readiness assessments treated `thul-nurayn-repo` (D1–D6 code + tarball) as an existing input. **It does not exist.** Therefore the original `IMPLEMENTATION_PLAN` package **P1 "Persistence"** — defined as *"apply schema + `PostgresRepository` behind the existing D2 ABC"* — **presupposes code that has not been written**. The true first package must be **D1 Foundation (built from zero)**. This report re-sequences accordingly while preserving the spec's dependency order, Stop Gates, and Definition-of-Done discipline.

**Invariants that constrain every phase (from CLAUDE.md / Master Spec):**
- Single Source of Truth = **Score Engine in Python** (TradingView = signal generator only).
- **Risk ⟂ Execution** — no order leaves without `RiskGate(D4) Accept` + `Validation/Duplicate(D5)`.
- **PostgreSQL = source of truth**; **Redis = ephemeral** only.
- **Fail-Safe** everywhere on the risk/execution path; **DLQ** with no automatic retry on that path.
- **Append-only** for `audit_logs` / `system_events`.
- **No risk-based position sizing** in v1 (fixed 10%/trade); sizing change = V2-001.
- Money = `Decimal`; time = UTC; ids = UUID; explicit type hints; limits read from `constants`, never hard-coded magic numbers in logic.

---

## 2. Recommended Repository Structure

A single Python backend repository (per D1 §2, expanded to cover D2–D9 domains as separate, single-responsibility packages). Design/structure only — no code.

```
thul-nurayn/
├── README.md
├── pyproject.toml                 # deps, tool config (lint, type-check, test)
├── .env.example                   # config keys only — NO secrets
├── .gitignore                     # excludes secrets, .env, build artifacts
│
├── docs/                          # the approved pack = source of truth (committed)
│   ├── THUL-NURAYN_v1_MASTER_SPECIFICATION.md
│   ├── CLAUDE.md
│   ├── IMPLEMENTATION_PLAN.md
│   ├── V2_BACKLOG.md
│   ├── PROJECT_STATE_REPORT.md
│   ├── PROJECT_FILE_INDEX.md
│   ├── reports/                   # D1_FOUNDATION … D9_UI_ARCHITECTURE
│   ├── CHANGE_REQUESTS/           # every change logged here
│   └── DECISIONS/                 # owner approvals / stop-gate sign-offs
│
├── db/
│   ├── migrations/001_init_schema.sql      # 19 tables, FKs, CHECK constraints, indexes
│   └── partitions/partition_retention.sql  # monthly RANGE partitions + Hot→Warm→Cold
│
├── src/
│   ├── enums/                     # MarketRegime, EngineType, Direction, OrderStatus,
│   │                              #   PositionStatus, UserRole, RiskDecision, SeverityLevel,
│   │                              #   TradeClassification, Market, SystemEventType, AuditEventType
│   ├── models/                    # 17 entities + 2 bridges (dataclasses; Decimal/UUID/tz-aware)
│   │
│   ├── config/                    # settings loader (constants source)
│   ├── logging/                   # structured logging + correlation id
│   ├── redis/                     # ephemeral state/locks (non-persistent)
│   ├── validation/                # shared validation helpers
│   │
│   ├── data_access/               # D2: Repository(ABC), InMemoryRepository,
│   │                              #     BridgeRepository, DataAccessLayer, errors
│   ├── selection/                 # D3: regime, core_scanner, turbo_scanner, rs, breakout,
│   │                              #     rvol, pead, ranking, classification, constants.py
│   ├── risk/                      # D4: 10 gates, fail_safe, risk_decision_engine
│   ├── execution/                 # D5: order/fill/position state machines, validation,
│   │                              #     duplicate_protection, position_verification,
│   │                              #     broker_sync_contract(ABC), reconciliation, audit_flow
│   ├── portfolio/                 # D6: account_state, portfolio_state, pnl, equity, statistics
│   │
│   ├── broker/                    # D7: broker_adapter(ABC), market_data_adapter(ABC),
│   │                              #     connection_manager, sync_manager, reconnection,
│   │                              #     error_classifier, killswitch_bridge   (contracts first)
│   ├── api/                       # 4B: FastAPI /v1, auth, roles, versioning   (later phase)
│   ├── workers/                   # scheduler, workers, DLQ                    (later phase)
│   └── ops/                       # D8: health, alerting, backup/recovery hooks (later phase)
│
├── tests/
│   ├── unit/                      # per-domain unit tests (D1…D6) — no network, InMemory repo
│   ├── integration/               # layers + Redis + DLQ + API/roles
│   └── e2e/                       # Signal→Score→Risk→Exec→Fill→Portfolio (Mock provider)
│
└── docker/                        # compose + dockerfiles (backend, postgres, redis, workers)
                                   # IB Gateway + dashboard added only at their phases
```

**Notes**
- `src/selection/constants.py` is the single home for all D3 thresholds, transcribed verbatim from the Master Spec.
- `src/api`, `src/workers`, `src/ops`, `src/broker` impls, and any dashboard live behind their own phases/stop-gates; their directories may exist as empty placeholders but carry no logic until reached.
- Dashboard (D9) is a **separate Next.js frontend** delivered only under explicit owner approval (P7); it is intentionally absent from the backend tree above.

---

## 3. Phase-by-Phase Build Plan

Re-sequenced for a from-scratch build. Each phase ends with a **Stop Gate** (review + owner approval) before the next begins. The right-hand column maps to the original `IMPLEMENTATION_PLAN` package label where one applies.

| Phase | Name | Scope (build) | Definition of Done | Orig. label |
|------|------|---------------|--------------------|-------------|
| **B0** | Bootstrap | Repo init; Python toolchain (lint/type-check/test runner); commit the approved docs; docker skeleton (no logic); `.env.example`; CI that runs lint+types+tests | Empty test suite runs green; docs are the committed source of truth | — (new, required) |
| **B1** | **D1 Foundation** | `001_init_schema.sql` (19 tables, UUID PKs, FK `ON DELETE RESTRICT`, CHECK constraints, indexes); partition/retention SQL; domain models (dataclasses); enums; test harness | Enum + model + schema-constraint unit tests green; schema validates (offline OK) | (true **P1**) |
| **B2** | **D2 Data Access** | `Repository` ABC; `InMemoryRepository`; `BridgeRepository`; `DataAccessLayer` (19 repos); errors. Append-only + Duplicate + Filter validation + Order→Fill→Position shape | D2 unit tests green (rebuild the ~17→36 baseline); no business logic in DAL | part of P2 |
| **B3** | **D3 Selection** | Market Regime; Core/Turbo scanners; RS, Breakout, RVOL, PEAD engines; Ranking; Classification; `constants.py` (verbatim thresholds). Consumes *passed-in* market facts (no indicator calc) | D3 boundary tests green (Ultra Golden=100, Bear blocks Long, RS<80 blocks, VWAP for Short, etc.) | part of P2 |
| **B4** | **D4 Risk Gate** | 10 gates (Max Open, Max Trades/Day, Daily/Weekly/Monthly DD, Consecutive Loss, Sector Exposure, Kill Switch, Fail-Safe) + Risk Decision Engine (AND of gates; Kill Switch evaluated first) | D4 tests green: each gate at boundary, single-gate reject, Fail-Safe on missing/bad input | part of P2 |
| **B5** | **D5 Execution Domain** | Order/Fill/Position state machines; Order validation (Σfills ≤ qty); Duplicate protection; Position verification; `BrokerSyncContract` (ABC); SyncReconciliation; Audit event flow. **No broker connection.** | D5 tests green: legal/illegal transitions, terminal states, duplicate reject, drift/disconnected Fail-Safe | part of P2 |
| **B6** | **D6 Portfolio** | Account/Portfolio state; Realized/Unrealized PnL (Long/Short); Equity; HWM; Drawdown (aligned to D4); Open/Closed registries; D/W/M statistics; snapshot(marks) | **Cumulative D2–D6 = 91 unit tests green** (the spec's acceptance baseline, now actually achieved) | part of P2 |
| **B7** | Persistence | Provision PostgreSQL; apply schema; implement `PostgresRepository` behind the D2 `Repository` ABC — consumers untouched | D2 test suite passes against **real PostgreSQL** | **P1 (orig)** |
| **B8** | Core Wiring | In-process pipeline Signal→Score→Risk→Exec→Portfolio; Redis ephemeral state | Internal flow runs end-to-end and is logged/persisted | **P2 (orig)** |
| **B9** | API Layer (4B) | FastAPI `/v1` + Auth + Roles (Owner/Operator/Viewer) + Versioning | `/v1` functional; role enforcement; authorization denies escalation | **P3 (orig)** |
| **B10** | Workers / DLQ | Scheduler, workers, durable cycles, DLQ (no auto-retry on risk/exec path) | Failed messages land in DLQ; processing resumes after recovery | **P4 (orig)** |
| **B11** | Data Provider (Mock) | Feed D3 facts and D6 marks via a **Mock** provider (no broker) | D3/D6 receive correct shaped data; pipeline produces signals→portfolio | **P5 (orig)** |
| **B12** | Operations | Health checks, alerting (Warning/Critical/Emergency), logging, backup, recovery test, runbooks | Health + escalation + restored-backup verified | **P6 (orig)** |
| **B13** | Dashboard | Next.js read/control UI per D9 (separate frontend) | Backend-matching views; role-gated controls | **P7 (orig)** — *owner approval required* |
| **B14** | Broker (Paper) | IB Gateway adapter behind D5/D7 contracts; **Paper first** | Paper order path; fills ingested; Fail-Safe + safety layers verified | **P8 (orig)** — *owner approval required* |

**Hard gates:** B13 (UI) and B14 (Broker/IBKR/TradingView/Live) **do not start without an explicit owner order**. Live trading requires a full Production Readiness checklist + Paper sign-off after B14.

---

## 4. Development Order (and why)

Dependency-driven, bottom-up — each layer depends only on those beneath it:

```
B0 Bootstrap
  └─ B1 D1 Foundation        (enums + models + schema; everything depends on D1)
       └─ B2 D2 Data Access  (repositories over D1 entities — storage only)
            ├─ B3 D3 Selection    (pure, deterministic; consumes passed-in facts)
            ├─ B4 D4 Risk Gate    (pure decision over RiskState; AND of gates)
            ├─ B5 D5 Execution    (state machines + broker *contracts*, no connection)
            └─ B6 D6 Portfolio    (account/PnL/equity/drawdown — read-only of marks)
                 └─ B7 Persistence (swap InMemory → PostgresRepository, ABC unchanged)
                      └─ B8 Core Wiring (Signal→Score→Risk→Exec→Portfolio + Redis)
                           └─ B9 API (/v1 + auth/roles)
                                └─ B10 Workers/DLQ
                                     └─ B11 Data Provider (Mock)
                                          └─ B12 Operations
                                               └─ [B13 Dashboard] · [B14 Broker Paper]
```

**Rationale**
1. **D1 first** — all entities/enums are foundational; nothing compiles or tests without them.
2. **D2 before any domain** — domains need a storage interface, but it must be the **InMemory** implementation so D3–D6 can be built and tested **without a database** (matches the spec's "memory-backed, no network" unit-test posture).
3. **D3–D6 are pure/deterministic** — they can be built and fully unit-tested in any order after D2; building them before persistence keeps logic decoupled from infrastructure.
4. **Persistence (B7) after the domains** — `PostgresRepository` is a drop-in behind the D2 ABC (Dependency Inversion); consumers never change. This is why the original "P1 Persistence" is correctly a *later* step once D1/D2 exist.
5. **API/Workers/Ops** sit on top of a working, persisted core.
6. **UI and Broker last**, behind explicit approval — they are the highest-risk, outward-facing surfaces.

---

## 5. Testing Strategy

**Pyramid (per IMPLEMENTATION_PLAN §3):** Unit → Integration → E2E(Mock) → [Paper on approval].

| Level | What | Environment |
|-------|------|-------------|
| **Unit** | Each domain component in isolation; deterministic; **no network**; `InMemoryRepository` for storage | `unittest`, in-memory |
| **Integration** | Layers wired together + Redis + DLQ + API/roles; `PostgresRepository` against real PostgreSQL | Docker (postgres+redis) |
| **E2E (Mock)** | Full pipeline Signal→Score→Risk→Exec→Fill→Portfolio with the **Mock** data provider | Docker, no broker |
| **Paper** | Live-but-no-money via IB Gateway Paper | Owner approval only |

**Mandatory critical-path coverage (non-negotiable, at boundaries):**
- **Fail-Safe** — any missing/invalid input on risk/execution path ⇒ reject/no-order.
- **Duplicate Order Protection** — `(signal+instrument+engine+direction)` dedupe.
- **Sensitive safety layers** — role/code/liquidity/size/risk/trading-hours ⇒ Order Rejected.
- **Kill Switch** L1–L4 — evaluated first; Owner-only manual activation; recorded in `system_events`.
- **Recovery** — restore-from-backup, reconcile-before-resume, no auto-retry on risk/exec path (DLQ → manual).
- **Boundary values** — every numeric threshold tested at the limit (RS 80/90, RVOL 1.5/3.0, Gap 4%, ATR 0.5$, DD −3%/−6%, Max 5/5, Sector 25%, classification 90/95/100).

**Acceptance baselines:**
- **B6 target:** cumulative **D2–D6 = 91 green unit tests** (the spec's stated correctness bar).
- **B7:** the same D2 suite passes on PostgreSQL.
- Tests stay green at every Stop Gate; a failing acceptance test blocks progression.

**Standards:** `Decimal` for money, UTC timestamps, UUID ids, explicit type hints; thresholds read from `constants`; no magic numbers in logic; no secrets in code/logs/git (secret scanning before merge).

---

## 6. First Implementation Package — **True P1 = B1: D1 Foundation**

> The single next package to build. Everything else is gated behind it.

**Goal:** Establish the project's data foundation only — database schema, domain models, enums, partition/retention, and the test harness. No trading, scanning, scoring, risk, execution, portfolio, broker, API, or UI logic.

**In scope (deliverables):**
1. **`db/migrations/001_init_schema.sql`** — the **19 tables**:
   `sectors · users · instruments · market_snapshots · scanner_results · signals · scores · risk_checks · orders · positions · fills · risk_snapshots · news_events · earnings_events · performance_records · audit_logs · system_events · signal_news · signal_earnings`
   with UUID primary keys, foreign keys `ON DELETE RESTRICT`, and `CHECK` constraints on enum columns; indexes on hot lookups (sector/state/classification/engine/time).
2. **`db/partitions/partition_retention.sql`** — monthly `RANGE` partitions for `signals · orders · audit_logs · system_events · market_snapshots · risk_snapshots`; retention Hot→Warm→Cold (archive, never delete audit/compliance data).
3. **`src/models/`** — **17 entities + 2 bridges** as dataclasses; `Decimal` for money, UUID ids, timezone-aware timestamps; `VIX/State` nullable where specified.
4. **`src/enums/`** — `MarketRegime · EngineType · Direction · OrderStatus · PositionStatus · UserRole · RiskDecision · SeverityLevel` (+ supporting `TradeClassification · Market · SystemEventType · AuditEventType`).
5. **Test harness** + the D1 unit tests (enum integrity, model construction/typing, schema constraint expectations).
6. **Repo bootstrap (B0 folded in if not already done):** toolchain, lint/type-check, test runner, committed docs.

**Explicitly OUT of scope (deferred to later phases):** Scanner · Ranking · Score · Risk · Execution · Portfolio · Broker · TradingView · Dashboard · News logic · Monitoring · API · the `config/logging/redis/validation` *behavior* (placeholders only).

**Acceptance criteria (Definition of Done):**
- Schema is valid and self-consistent (validates offline; live PostgreSQL apply belongs to B7 and does not gate B1).
- All enum/model/constraint unit tests green.
- Spec-conformant (every value from the Master Spec; no invented rules).
- Documented; change log entry created; **Stop Gate** for owner review.

**Stop Gate after B1:** Halt for review and approval before starting **B2 (D2 Data Access)**.

---

## Summary

- **State:** architecture done & frozen; **code = 0**; docs are the source of truth.
- **Correction:** original "P1 Persistence" assumed code that doesn't exist; the **true P1 is D1 Foundation**, then domains D2–D6, *then* persistence (B7).
- **Order:** D1 → D2 → (D3·D4·D5·D6) → Persistence → Wiring → API → Workers/DLQ → Data Provider(Mock) → Ops → [UI] → [Broker Paper], with Stop Gates throughout.
- **Bar:** rebuild to **91 green D2–D6 unit tests** by B6, with mandatory Fail-Safe / Duplicate / Kill Switch / Recovery / boundary coverage.

**STOP.** Reset plan delivered. No code written. Awaiting approval before beginning **B1 (D1 Foundation)**.
