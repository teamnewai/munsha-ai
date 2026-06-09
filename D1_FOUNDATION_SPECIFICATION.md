# D1_FOUNDATION_SPECIFICATION

**Phase:** B1 — D1 Foundation (the true P1)
**Status:** Official build specification for B1.
**Derived only from:** `THUL-NURAYN_v1_MASTER_SPECIFICATION` · `D1_FOUNDATION_REPORT` · `IMPLEMENTATION_RESET_REPORT`.
**Constraints:** No code. No SQL. No implementation. Specification of *what* to build — B1 produces the SQL/code under this spec.
**Frozen policy:** v1 = FROZEN. Every value transcribed from the Master Spec; no invented rules. Any strategic change → V2_BACKLOG + stop.

> **Derivation discipline:** This document states only what the three sources establish. Attributes the sources name explicitly are listed. Attributes the sources imply by relationship but do not enumerate are marked **[detail in B1]** — to be finalized during B1 from the relationships/constraints below, still with no invented business rules.

---

## 1. Repository Structure (D1 scope)

From `D1_FOUNDATION_REPORT §2` and the `IMPLEMENTATION_RESET_REPORT` (B1 deliverables). B1 touches only the foundation subset of the full repository tree:

```
thul-nurayn/
├── docs/
│   ├── THUL-NURAYN_v1_MASTER_SPECIFICATION.md
│   ├── D1_FOUNDATION_REPORT.md
│   ├── IMPLEMENTATION_RESET_REPORT.md
│   ├── D1_FOUNDATION_SPECIFICATION.md      # this document
│   ├── CHANGE_REQUESTS/                     # every change logged here
│   └── V2_BACKLOG/                          # deferred items only
│
├── db/
│   ├── migrations/        # initial schema artifact (produced in B1)
│   └── partitions/        # partition + retention artifact (produced in B1)
│
├── src/
│   ├── enums/             # the approved enumerations (Section 2)
│   ├── models/            # the 17 entities + 2 bridges (Section 3)
│   ├── config/            # placeholder only — later layer
│   ├── logging/           # placeholder only — later layer
│   ├── redis/             # placeholder only — later layer
│   └── validation/        # placeholder only — later layer
│
└── tests/                 # D1 unit tests (Section 10)
```

**Out of B1's structure (later phases):** `data_access`, `selection`, `risk`, `execution`, `portfolio`, `broker`, `api`, `workers`, `ops`, `docker`, and any dashboard. `config/logging/redis/validation` exist as **placeholders only** — D1 foundation = enums + schema + models (`D1_FOUNDATION_REPORT §8`).

---

## 2. Enum Definitions

The approved enumerations (`D1_FOUNDATION_REPORT §6`), with members transcribed from the Master Spec.

### Core enums

| Enum | Members | Source |
|------|---------|--------|
| **MarketRegime** | Bull · Bear · Sideways | Master §4 |
| **EngineType** | Core · Turbo | Master §1 / §8 (Core Swing + Turbo Intraday) |
| **Direction** | Long · Short | Master §2 / §12–13 |
| **OrderStatus** | New · Sent · Filled · Rejected · Cancelled | Master §20; D5 lifecycle |
| **PositionStatus** | Open · Closed | Master §20; D6 |
| **UserRole** | Owner · Operator · Viewer | Master §20 |
| **RiskDecision** | Accepted · Rejected | Master §14; D4 Decision Engine |
| **SeverityLevel** | Warning · Critical · Emergency | D8 alerting levels (foundation enum) |

### Supporting enums

| Enum | Members | Source |
|------|---------|--------|
| **TradeClassification** | UltraGolden (=100) · Golden (95–99) · Strong (90–94) · Watchlist (<90) | Master §9–§11 |
| **Market** | NASDAQ · NYSE | Master §2 |
| **SystemEventType** | ServiceStarted · ServiceStopped · WorkerFailure · Redis/Postgres/Gateway events · KillSwitchActivated | D8 §6 (technical events) |
| **AuditEventType** | Login · Setting/Risk Change · Order · Shutdown · Error | D8 §6 (decision/user events) |

**Rules for enums in B1:**
- Enums are the canonical, closed value sets; every enum-typed table column is constrained to its members (Section 6).
- No additional members may be introduced (FROZEN). A needed new value = V2 + stop.
- Exact string/identifier spellings of members are finalized in B1 but must map 1:1 to the members above.

---

## 3. Domain Models

**17 entities + 2 bridges = 19 models** (`D1_FOUNDATION_REPORT §3, §5`), implemented as dataclasses with: money as `Decimal`, identifiers as UUID, timestamps timezone-aware (UTC). `VIX/State`-type fields are nullable where the spec marks them optional (`D1_FOUNDATION_REPORT §5`).

### 17 Entities

| # | Model | Purpose (derived) | Key / notable attributes |
|---|-------|-------------------|--------------------------|
| 1 | **Sector** | Sector reference used for the ≤25% sector-exposure rule | id; name. (Master §6/§14) |
| 2 | **User** | Actor with a role; basis for authorization | id; role (UserRole). **No secrets stored** (CLAUDE.md §5; D8 §11). [detail in B1] |
| 3 | **Instrument** | Tradable symbol within the universe | id; symbol; market (Market); sector_id → Sector. (Master §2) |
| 4 | **MarketSnapshot** | Point-in-time market/regime facts (e.g., SPY vs SMA200) | id; timestamp; regime (MarketRegime); optional VIX/state (nullable). (Master §4) |
| 5 | **ScannerResult** | Output of a scanner pass for a candidate | id; engine (EngineType); instrument ref. (Master §3; D3) |
| 6 | **Signal** | A generated trade signal | id; engine (EngineType); direction (Direction); instrument ref; timestamp. (Master §3 → §20 chain) |
| 7 | **Score** | Scoring result, **1:1 with Signal** | id; signal_id → Signal (unique); engine; total /100; component breakdown. (Master §8) |
| 8 | **RiskCheck** | Risk-gate decision, **1:1 with Signal** | id; signal_id → Signal (unique); decision (RiskDecision); gate results. (Master §14; D4) |
| 9 | **Order** | Order lifecycle record | id; status (OrderStatus); instrument ref; direction; user ref; timestamp. (Master §20; D5) |
| 10 | **Position** | Open/closed position | id; status (PositionStatus); engine; instrument ref; direction. (Master §20; D6) |
| 11 | **Fill** | Execution fill event (final/immutable event) | id; order_id → Order; position_id → Position; quantity; price (Decimal); timestamp. (Master §20; D5) |
| 12 | **RiskSnapshot** | Point-in-time risk state (drawdowns, counts, exposures) | id; timestamp; drawdown/positions/consecutive-loss/sector-exposure fields. (Master §14; D4/D6) |
| 13 | **NewsEvent** | News / catalyst event | id; instrument ref; timestamp. (Master §7) |
| 14 | **EarningsEvent** | Earnings event (PEAD, surprise within ≤10 days) | id; instrument ref; timestamp. (Master §3/§7) |
| 15 | **PerformanceRecord** | Realized performance / period statistics | id; period; trades/wins/losses/realized/win_rate fields. (D6) |
| 16 | **AuditLog** | **Append-only** decision/user audit trail | id; event type (AuditEventType); actor (User) ref; timestamp; payload. (D8 §6) |
| 17 | **SystemEvent** | **Append-only** technical/system event log | id; event type (SystemEventType); severity (SeverityLevel); timestamp; payload. (D8 §6) |

### 2 Bridges (junction models)

| # | Bridge | Purpose | Composition |
|---|--------|---------|-------------|
| 18 | **SignalNews** | Many-to-many link Signal ↔ NewsEvent | signal_id → Signal; news_event_id → NewsEvent (composite key). (D1 §3; D2 BridgeRepository) |
| 19 | **SignalEarnings** | Many-to-many link Signal ↔ EarningsEvent | signal_id → Signal; earnings_event_id → EarningsEvent (composite key). (D1 §3; D2 BridgeRepository) |

**Model standards (CLAUDE.md §9; D1 §5):** explicit type hints; `Decimal` for all monetary values; UUID identifiers; timezone-aware UTC timestamps; no business logic inside models (D1 is structure only).

---

## 4. Database Tables

The **19 tables** (`D1_FOUNDATION_REPORT §3`), one per domain model above, matching Phase-4A naming:

```
sectors · users · instruments · market_snapshots · scanner_results ·
signals · scores · risk_checks · orders · positions · fills ·
risk_snapshots · news_events · earnings_events · performance_records ·
audit_logs · system_events · signal_news · signal_earnings
```

- Table-to-model mapping is 1:1 with Section 3 (17 entity tables + 2 bridge tables).
- Column-level definitions (names/types/nullability beyond what Sections 2–3 and 6 establish) are **[detail in B1]**, produced under this spec without introducing new rules.
- Append-only tables: `audit_logs`, `system_events` (Section 6).
- Partitioned tables: see Section 7.

---

## 5. Relationships

The execution/data chain (`D1_FOUNDATION_REPORT §4`; Master §20):

```
MarketSnapshot → ScannerResult → Signal → Score(1:1) → RiskCheck(1:1)
              → Order → Fill → Position → PerformanceRecord
```

Cardinalities (Master §20; D2 §4):

| Relationship | Cardinality |
|--------------|-------------|
| Order ↔ Fill | **1 ─ \*** (one order, many fills) |
| Fill ↔ Position | **\* ─ 1** (many fills, one position) |
| Order ↔ Position | **\* ─ 1** (many orders, one position) |
| Signal ↔ Score | **1 ─ 1** |
| Signal ↔ RiskCheck | **1 ─ 1** |
| Instrument ↔ Sector | **\* ─ 1** |
| Signal ↔ NewsEvent | **\* ─ \*** via `signal_news` |
| Signal ↔ EarningsEvent | **\* ─ \*** via `signal_earnings` |
| User ↔ Orders / Positions / AuditLogs | **1 ─ \*** |

Audit coverage (Master §20; D8 §6): every step emits to `audit_logs` / `system_events` (append-only).

---

## 6. Constraints

From `D1_FOUNDATION_REPORT §3, §7` and CLAUDE.md:

1. **Primary keys** — synthetic **UUID** PKs on all tables.
2. **Foreign keys** — referential integrity with **`ON DELETE RESTRICT`** (no cascading deletion of referenced rows).
3. **Enum check constraints** — every enum-typed column is constrained to its enum's members (Section 2).
4. **Append-only immutability** — `audit_logs` and `system_events` reject update/delete (foundation supports immutability; enforcement surfaces as `ImmutableViolation` at the D2 layer — out of B1 behavior, but the table design must permit it).
5. **1:1 uniqueness** — `scores.signal_id` and `risk_checks.signal_id` are unique (enforces Signal↔Score and Signal↔RiskCheck 1:1).
6. **Bridge composite keys** — `signal_news` and `signal_earnings` keyed on their two FKs.
7. **Typing constraints** — monetary columns are decimal-typed (`Decimal`); timestamps are timezone-aware (UTC); identifiers are UUID.
8. **Required fields / not-null** — applied to keys, enum columns, and timestamps. Field-level nullability beyond keys/enums is **[detail in B1]**, except where the spec marks a field optional (e.g., VIX/state nullable).
9. **No invented constraints** — only constraints derivable from the three sources; any further rule = stop + clarify.

> Business validations (e.g., Σfills ≤ order qty, money > 0) belong to **later domains (D5/D4/D6)**, not D1.

---

## 7. Partition Strategy

From `D1_FOUNDATION_REPORT §7`:

- **Scheme:** time-based **RANGE partitioning, monthly**.
- **Partitioned tables (6):**
  `signals · orders · audit_logs · system_events · market_snapshots · risk_snapshots`.
- Rationale: these are the high-volume, time-series / append-heavy tables; monthly ranges support retention tiering (Section 8) and bounded query/maintenance scope.
- Non-partitioned tables: the remaining reference/state tables (`sectors`, `users`, `instruments`, `scanner_results`, `scores`, `risk_checks`, `positions`, `fills`, `news_events`, `earnings_events`, `performance_records`, `signal_news`, `signal_earnings`) unless the spec directs otherwise. Partition key per table = its primary timestamp. **[detail in B1]**

---

## 8. Retention Strategy

From `D1_FOUNDATION_REPORT §7` (and D8 maintenance notes):

- **Tiering:** **Hot → Warm → Cold**.
- **Compliance / audit data is archived, never deleted** — `audit_logs` and `system_events` (and audit/compliance partitions) move to Cold/archive but are retained.
- Cold archive supports audit/back-test access (read).
- Retention/archival operates on the monthly partitions from Section 7.
- Concrete retention windows (RPO/RTO and per-tier durations) are **operationally defined later** (D8) — not a hard-coded value in D1, and not invented here.

---

## 9. Validation Rules

D1 validation is **data-integrity only**; behavioral validation is deferred (`D1_FOUNDATION_REPORT §8` — config/logging/validation are later placeholder layers).

In-scope for B1:
1. **Enum membership** — values must belong to the declared enum (via check constraints, Section 6.3).
2. **Referential integrity** — FK targets must exist; deletes restricted (Section 6.2).
3. **Type correctness** — `Decimal` money, UTC tz-aware timestamps, UUID ids (Section 6.7).
4. **Required-field presence** — keys, enum columns, timestamps not null (Section 6.8).
5. **Uniqueness** — 1:1 signal links and bridge composite keys (Section 6.5–6.6).
6. **Append-only intent** — audit/system tables structurally support immutability (Section 6.4).

Explicitly **out of D1** (deferred): scanner thresholds, score math, risk limits, Σfills ≤ qty, duplicate-order checks, money>0 / drawdown checks, position verification — these live in D3/D4/D5/D6.

---

## 10. Test Plan

Framework `unittest`, **no network**, offline (`D1_FOUNDATION_REPORT §9`; IMPLEMENTATION_RESET_REPORT §5). D1 tests must stay green at the Stop Gate.

| Group | Coverage |
|-------|----------|
| **Enum integrity** | Each enum exposes exactly its specified members (Section 2); no extras; stable identifiers. |
| **Model construction & typing** | All 19 models instantiate with correct field types — `Decimal` money, UUID ids, tz-aware UTC timestamps; nullable fields (e.g., VIX/state) accept null. |
| **Schema constraints** | UUID PKs present; FK `ON DELETE RESTRICT` expectations; enum check-constraint expectations; 1:1 uniqueness on `scores.signal_id` / `risk_checks.signal_id`; bridge composite keys. |
| **Append-only intent** | Schema/model design permits immutability for `audit_logs` / `system_events` (deletion/update intent rejected — enforcement verified fully in D2). |
| **Relationship shape** | Order→Fill→Position cardinalities (1─\*, \*─1, \*─1) and the MarketSnapshot→…→PerformanceRecord chain are representable; bridges link Signal↔News / Signal↔Earnings. |
| **Partition/retention metadata** | Declared partitioned set = the 6 tables in Section 7; retention tiering metadata present; audit/system never marked for deletion. |

- Offline schema validation only; **applying the schema to a live PostgreSQL is B7**, not B1, and does not gate B1.
- These tests form the first slice of the cumulative **D2–D6 = 91** acceptance baseline targeted by B6 (IMPLEMENTATION_RESET_REPORT §5).

---

## 11. Definition Of Done

B1 is complete when (IMPLEMENTATION_RESET_REPORT §3/§6; CLAUDE.md DoD):

1. **Spec conformance** — schema, models, and enums match this specification and the Master Spec exactly; **no invented values or rules**.
2. **Schema validity** — initial schema + partition/retention artifacts are valid and self-consistent (offline validation OK; live PostgreSQL apply = B7).
3. **Enums complete** — all core + supporting enums present with exactly the specified members.
4. **Models complete** — all 17 entities + 2 bridges present with correct typing and relationships.
5. **Constraints expressed** — UUID PKs, FK `ON DELETE RESTRICT`, enum checks, 1:1 uniqueness, bridge keys, append-only intent.
6. **Partition + retention defined** — 6 monthly-partitioned tables; Hot→Warm→Cold; audit/compliance never deleted.
7. **Tests green** — all D1 unit tests pass (Section 10); no network dependency.
8. **No out-of-scope logic** — no Scanner/Score/Risk/Execution/Portfolio/Broker/API/UI behavior introduced.
9. **Documentation** — change log entry in `docs/CHANGE_REQUESTS/`; this spec is the recorded source for B1.
10. **Stop Gate** — halt for owner review/approval before starting **B2 (D2 Data Access)**.

---

**This document is the official build specification for B1 (D1 Foundation).** It contains no code, no SQL, and no implementation. B1 produces the schema/model/enum artifacts and tests strictly under this spec.

**STOP.** Awaiting approval before beginning B1 implementation.
