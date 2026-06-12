# D1_BUILD_REPORT

**Phase executed:** B0 Bootstrap → **B1 — D1 Foundation**
**Authorization:** Owner approval (adopt recovered enums; authorize column schema; B0 bootstrap; repository target) per `B1_READINESS_DECISION §5`.
**Scope built:** enums · domain models · DB schema · partition/retention · D1 unit tests. **No** Scanner/Strategy/Risk/Execution/Portfolio/Broker/API/UI logic.
**Result:** ✅ Complete. **37/37 unit tests pass** (offline, no network, no DB).
**Location:** all build artifacts under `thul-nurayn/` (isolated from the unrelated app already in the repo).

---

## 1. What was built

### B0 — Bootstrap
- Repository scaffold under `thul-nurayn/` per `[D1 §2]`.
- Python toolchain config `pyproject.toml` (Python ≥3.11; B1 is pure-stdlib).
- `README.md` documenting B1 scope and how to run tests.
- Placeholder packages `src/{config,logging,redis,validation}` (later layers — no behavior).

### B1 — D1 Foundation

| Deliverable | Path | Content |
|-------------|------|---------|
| Enums | `thul-nurayn/src/enums/__init__.py` | 12 enumerations (8 core + 4 supporting) |
| Models | `thul-nurayn/src/models/__init__.py` | 17 entity + 2 bridge dataclasses |
| Schema | `thul-nurayn/db/migrations/001_init_schema.sql` | 19 tables, constraints, indexes, partition declarations |
| Partitions/Retention | `thul-nurayn/db/partitions/partition_retention.sql` | monthly RANGE partitions + Hot→Warm→Cold |
| Tests | `thul-nurayn/tests/` | `test_enums.py`, `test_models.py`, `test_schema.py` |

---

## 2. Enumerations (12)

Members transcribed from approved sources — **no invention**.

| Enum | Members | Origin |
|------|---------|--------|
| MarketRegime | Bull · Bear · Sideways | `[MS §4]` |
| EngineType | Core · Turbo | `[MS §1,§8]` |
| Direction | Long · Short | `[MS §2,§12–13]` |
| UserRole | Owner · Operator · Viewer | `[MS §20]` |
| TradeClassification | UltraGolden · Golden · Strong · Watchlist | `[MS §9–11]` |
| Market | NASDAQ · NYSE | `[MS §2]` |
| OrderStatus | New · Sent · Filled · Rejected · Cancelled | recovered `[D5]` (owner-approved 5a) |
| PositionStatus | Open · Closed | recovered `[D5]` |
| RiskDecision | Accepted · Rejected | recovered `[D4]` |
| SeverityLevel | Warning · Critical · Emergency | recovered `[D8]` |
| SystemEventType | ServiceStarted · ServiceStopped · WorkerFailure · RedisEvent · PostgresEvent · GatewayEvent · KillSwitchActivated · IBGatewayReconnected | recovered `[D8 §6, D7 §4]` |
| AuditEventType | Login · SettingRiskChange · Order · Shutdown · Error | recovered `[D8 §6]` |

Each is a `str` Enum so values serialize to the exact spellings used by the SQL CHECK constraints.

---

## 3. Domain Models (17 + 2)

dataclasses with: `Decimal` money · `UUID` ids · timezone-aware `datetime` · nullable VIX/state `[D1 §5]`.

**Entities (17):** Sector · User · Instrument · MarketSnapshot · ScannerResult · Signal · Score · RiskCheck · Order · Position · Fill · RiskSnapshot · NewsEvent · EarningsEvent · PerformanceRecord · AuditLog · SystemEvent.
**Bridges (2):** SignalNews · SignalEarnings.

---

## 4. Schema (19 tables)

UUID PKs · FK `ON DELETE RESTRICT` · enum **CHECK** constraints · indexes on sector/state/classification/engine/time · 6 monthly-RANGE partitioned tables · append-only `audit_logs`/`system_events` `[D1 §3,§4,§7]`.

### B1 schema-design decisions (authorized under approval 5b)
The approved sources gave table names, relationships, constraints, and partition/retention strategy, but **not** column-level definitions. The following were designed in B1 and are recorded here:

1. **Enums enforced as `TEXT` + `CHECK (col IN (...))`** rather than native ENUM types — a literal reading of "CHECK constraints on enumerations" `[D1 §3]`.
2. **Column sets** per table derived from the relationship chain and the entities' stated purposes (e.g., `instruments(symbol, market, sector_id)`, `orders(status, quantity, …)`, `risk_snapshots(equity, high_water_mark, drawdowns, counts)`). Minimal and spec-aligned; no business rules embedded.
3. **References into partitioned parents** (`signals`, `orders`, `market_snapshots`) are stored as indexed UUID columns **without DB-level FKs**, because a PostgreSQL FK to a RANGE-partitioned table must include the partition key. Referential integrity for these is delegated to the **D2 Data Access Layer**. FKs to non-partitioned parents use `ON DELETE RESTRICT` as specified.
4. **1:1 enforcement** for Signal↔Score and Signal↔RiskCheck via `UNIQUE (signal_id)`.
5. **`Decimal`→`NUMERIC`**, **`datetime`→`TIMESTAMPTZ`**, **app-generated UUID PKs** (no DB default, avoids extension dependency for offline validation).
6. **`performance_records.period_type`** constrained by `CHECK (… IN ('daily','weekly','monthly'))` rather than a new enum (no 13th enum invented).
7. **`breakdown`/`detail`** stored as `JSONB` (score component breakdown; audit/system detail).
8. **Monthly partition convention** `<table>_pYYYYMM`; a sample month (2026-06) illustrates it; provisioning is operational (later phase).

> No thresholds, weights, risk limits, or strategy logic were introduced (out of D1 scope and FROZEN).

---

## 5. Tests — Results

Framework `unittest`, offline. **Ran 37 tests — all pass (~0.003s).**

| Suite | Tests | Coverage |
|-------|-------|----------|
| `test_enums.py` | 5 | exact 12-enum inventory; exact member value sets; str-valued; no duplicates |
| `test_models.py` | 17 | 19-model inventory; all dataclasses; per-model construction + type assertions (Decimal/UUID/tz/enum); nullable fields |
| `test_schema.py` | 15 | all 19 tables; exactly 19; UUID PKs; FK `ON DELETE RESTRICT`; **all 12 enum CHECK value sets exact**; 1:1 UNIQUE; 6 partitioned parents; monthly partitions; append-only markers; retention tiering; hot-lookup indexes |

```
Ran 37 tests in 0.003s
OK
```

---

## 6. Compliance with D1 Definition of Done `[D1S §11]`

| DoD item | Status |
|----------|--------|
| Spec conformance; no invented values | ✅ (enums transcribed; design decisions §4 documented) |
| Schema valid & self-consistent (offline; live apply = B7) | ✅ |
| Enums present (12) | ✅ |
| Models present (17 + 2) | ✅ |
| Constraints expressed | ✅ |
| Partition + retention defined | ✅ |
| Tests green, no network | ✅ 37/37 |
| No out-of-scope logic | ✅ |
| Documentation / build report | ✅ (this file) |
| Stop Gate before B2 | ✅ (honored — see below) |

---

## 7. Notes & residual items (carried forward, non-blocking for B1)

- Per-column schema was authored in B1 (approval 5b); §4 records the decisions for review.
- Recovered enum members (5a) are adopted as authoritative; `D1_FOUNDATION_SPECIFICATION.md §2` previously marked them "to be produced" under the stricter source rule — now satisfied.
- Live PostgreSQL application and `PostgresRepository` remain **B7**.

---

## B1 GATE

**B1 is COMPLETE.** Stopping at the B1 review gate.
**B2 (Data Access) has NOT been started** and will not begin without owner review/approval.

**STOP — awaiting review.**
