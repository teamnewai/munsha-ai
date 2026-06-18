# D1_FOUNDATION_SPECIFICATION

**Phase:** B1 — D1 Foundation (the true P1).
**Status:** Official build specification for B1.
**Sources used (ONLY these):**
- `[MS]` THUL-NURAYN_v1_MASTER_SPECIFICATION.md
- `[D1]` D1_FOUNDATION_REPORT.md
- `[RR]` IMPLEMENTATION_RESET_REPORT.md

**Rules for this document:** No assumptions. No invented requirements. No code. No SQL. No implementation. Any item not explicitly stated in the three sources above is marked verbatim:
> **"To be produced during B1 implementation."**

Each statement is tagged with its source `[MS]` / `[D1]` / `[RR]`. v1 = FROZEN; values are transcribed, not invented `[MS]`.

---

## 1. Repository Structure

Explicit D1 repository tree `[D1 §2]`:

```
thul-nurayn/
  docs/ (+ CHANGE_REQUESTS/ + V2_BACKLOG/)
  db/migrations/001_init_schema.sql
  db/partitions/partition_retention.sql
  src/enums/__init__.py
  src/models/__init__.py
  src/{config,logging,redis,validation}/   (later layers)
  tests/
```

- `src/config`, `src/logging`, `src/redis`, `src/validation` are **later layers**; D1 foundation = enums + schema + models only `[D1 §2, §8]`.
- B1 deliverables also include the test harness and D1 unit tests `[RR §6]`.
- Any directory/file detail beyond the tree above: **To be produced during B1 implementation.**

---

## 2. Enum Definitions

The approved enumeration **names** `[D1 §6]`:

> MarketRegime · EngineType · Direction · OrderStatus · PositionStatus · UserRole · RiskDecision · SeverityLevel
> (supporting) TradeClassification · Market · SystemEventType · AuditEventType

**Members** — only those explicitly stated in the three sources are listed; all others are gaps:

| Enum | Members (explicit in sources) | Source / Status |
|------|-------------------------------|-----------------|
| **MarketRegime** | Bull · Bear · Sideways | `[MS §4]` |
| **EngineType** | Core · Turbo | `[MS §1, §8]` (Core Swing + Turbo Intraday) |
| **Direction** | Long · Short | `[MS §2, §12–13]` |
| **OrderStatus** | **To be produced during B1 implementation.** | Name `[D1 §6]`; member set not enumerated in the three sources |
| **PositionStatus** | **To be produced during B1 implementation.** | Name `[D1 §6]`; member set not enumerated in the three sources |
| **UserRole** | Owner · Operator · Viewer | `[MS §20]` |
| **RiskDecision** | **To be produced during B1 implementation.** | Name `[D1 §6]`; member set not enumerated in the three sources |
| **SeverityLevel** | **To be produced during B1 implementation.** | Name `[D1 §6]`; member set not enumerated in the three sources |
| **TradeClassification** | Ultra Golden (=100) · Golden (95–99) · Strong (90–94) · Watchlist (<90) | `[MS §9–§11]` |
| **Market** | NASDAQ · NYSE | `[MS §2]` |
| **SystemEventType** | **To be produced during B1 implementation.** | Name `[D1 §6]`; member set not enumerated in the three sources |
| **AuditEventType** | **To be produced during B1 implementation.** | Name `[D1 §6]`; member set not enumerated in the three sources |

- Enum-typed columns are constrained to their members via CHECK constraints `[D1 §3]` (see Section 6).
- Exact identifier spellings of members: **To be produced during B1 implementation.**
- **Verification:** the six gap enums were re-checked against `[D1]` (esp. §6) and `[MS]`. `[D1 §6]` lists enum **names only**; `[D1 §1, §3, §6]` states the enumerations match the **Phase 4A shared enumerations** — an artifact *referenced by* `[D1]` but **not contained** in the allowed source set. The full member sets are therefore not present in any D1-approved source. See **Section 12 (Gap Analysis)**.

---

## 3. Domain Models

Composition: **17 entities + 2 bridges** as dataclasses `[D1 §5]`.

**Global field rules (explicit) `[D1 §5]`:**
- Money values → `Decimal`.
- Identifiers → UUID.
- Timestamps → timezone-aware.
- `VIX`/`State`-type fields are nullable; model columns mirror the physical tables.

**The 17 entity models** (1:1 with the entity tables, Section 4) `[D1 §3]`:
sectors · users · instruments · market_snapshots · scanner_results · signals · scores · risk_checks · orders · positions · fills · risk_snapshots · news_events · earnings_events · performance_records · audit_logs · system_events.

**The 2 bridge models** `[D1 §3, §4]`:
signal_news · signal_earnings (link Signal ↔ News / Signal ↔ Earnings).

- **Per-model field/attribute schemas (names, types, nullability beyond the global rules above):** **To be produced during B1 implementation.** The three sources state the model set, the global typing rules, and the relationships (Section 5), but do not enumerate per-model columns.

---

## 4. Database Tables

The **19 tables**, matching Phase-4A naming `[D1 §3]`:

```
sectors · users · instruments · market_snapshots · scanner_results ·
signals · scores · risk_checks · orders · positions · fills ·
risk_snapshots · news_events · earnings_events · performance_records ·
audit_logs · system_events · signal_news · signal_earnings
```

- Table set = 17 entity tables + 2 bridge tables (`signal_news`, `signal_earnings`) `[D1 §3, §5]`.
- Table-to-model mapping is 1:1 with Section 3.
- **Column-level table definitions (names, datatypes, nullability):** **To be produced during B1 implementation.**

---

## 5. Relationships

Explicit data/execution chain `[D1 §4]`:

```
Market Snapshot → Scanner Result → Signal → Score (1:1) → Risk Check (1:1)
               → Order → Fill → Position → Performance
```

Additional explicit relationships `[D1 §4]`:
- News / Earnings ─ Signal, via the bridge tables `signal_news` / `signal_earnings` (many-to-many).
- User → Orders / Positions / Audit.
- Every step → `audit_logs` / `system_events` (Append-only).

Explicit cardinalities `[MS §20]`:

| Relationship | Cardinality |
|--------------|-------------|
| Order ↔ Fill | 1 ─ * |
| Fill ↔ Position | * ─ 1 |
| Order ↔ Position | * ─ 1 |
| Signal ↔ Score | 1 ─ 1 `[D1 §4]` |
| Signal ↔ Risk Check | 1 ─ 1 `[D1 §4]` |

Explicit execution path `[MS §20]`: Execution → Fill → Portfolio → Position.

- **Any foreign-key relationship not listed above** (e.g., Instrument↔Sector, User↔specific tables beyond Orders/Positions/Audit): **To be produced during B1 implementation.**

---

## 6. Constraints

Explicit constraints `[D1 §3, §4, §5]`:

1. **Primary keys** — synthetic **UUID** primary keys `[D1 §3]`.
2. **Foreign keys** — **`ON DELETE RESTRICT`** `[D1 §3]`.
3. **Enum CHECK constraints** — on enumeration-typed columns `[D1 §3]`.
4. **Indexes** — on hot lookups: **sector / state / classification / engine / time** `[D1 §3]`.
5. **Append-only** — `audit_logs` and `system_events` are append-only `[D1 §4]`.
6. **Typing** — `Decimal` money, UUID ids, timezone-aware timestamps `[D1 §5]`.
7. **1:1 links** — Signal↔Score and Signal↔Risk Check are 1:1 `[D1 §4]`.

- **Not-null / uniqueness / default / additional constraint details beyond the above:** **To be produced during B1 implementation.**

---

## 7. Partition Strategy

Explicit `[D1 §7]`:

- Scheme: **time-based RANGE partitioning, monthly**.
- Partitioned tables: **`signals` · `orders` · `audit_logs` · `system_events` · `market_snapshots` · `risk_snapshots`**.

- **Partition key column per table, and partitioning of any other table:** **To be produced during B1 implementation.**

---

## 8. Retention Strategy

Explicit `[D1 §7]`:

- Tiering: **Hot → Warm → Cold**.
- Audit / back-test (compliance) data is **archived (مؤرشف) — not deleted**.

- **Concrete retention windows / tier durations / RPO-RTO values:** **To be produced during B1 implementation.** (`[D1 §7]` states tiering and "not deleted"; no numeric windows are specified in the three sources.)

---

## 9. Validation Rules

Scope statement `[D1 §8]`: validation/configuration/logging are **later placeholder layers**; D1 foundation = enums + schema + models only.

Explicit D1-level integrity rules (from Section 6) `[D1 §3, §4, §5]`:
- Enum membership enforced by CHECK constraints.
- Referential integrity via FK `ON DELETE RESTRICT`.
- Type correctness: `Decimal` / UUID / timezone-aware.
- Append-only integrity for `audit_logs` / `system_events`.

- **Any behavioral/business validation rules:** **To be produced during B1 implementation.** (Explicitly deferred to later layers per `[D1 §8]`; not part of D1 foundation.)

---

## 10. Test Plan

Explicit basis `[RR §5, §6]` and `[D1 §9]`:
- Framework posture: unit tests, **no network** `[RR §5]`.
- D1 unit tests cover: **enum integrity, model construction/typing, schema constraint expectations** `[RR §6]`.
- Tests originate from the D1 enumerations and the foundation builds upward `[D1 §9]`.
- D1 forms the first slice of the cumulative **D2–D6 = 91** acceptance baseline targeted later `[RR §5]`.
- Applying the schema to a live PostgreSQL is **B7**, not B1, and does not gate B1 `[RR §3, §6]`.

- **Detailed test cases, counts, fixtures, and file layout for D1:** **To be produced during B1 implementation.**

---

## 11. Definition Of Done

Explicit B1 Definition of Done `[RR §3, §6]` and `[D1 §11]`:

1. **Spec conformance** — schema, models, and enums match the specification; **no invented values** `[RR §6]`.
2. **Schema validity** — initial schema is valid and self-consistent; offline validation is acceptable (live PostgreSQL apply = B7) `[RR §3, §6]`.
3. **Enums** — present per Section 2 `[D1 §6]`.
4. **Models** — all 17 entities + 2 bridges present `[D1 §5; RR §6]`.
5. **Constraints expressed** — per Section 6 `[D1 §3, §4]`.
6. **Partition + retention defined** — per Sections 7–8 `[D1 §7]`.
7. **Tests green** — D1 unit tests pass, no network `[RR §5, §6]`.
8. **No out-of-scope logic** — no Scanner / Score / Risk / Execution / Portfolio / Broker / API / UI behavior `[D1 §1; RR §6]`.
9. **Documentation** — change-log entry recorded `[RR §6]`; this spec is the recorded source for B1.
10. **Stop Gate** — halt for owner review/approval before **B2 (D2 Data Access)** `[D1 §11; RR §3]`.

- **Any additional acceptance criteria beyond the above:** **To be produced during B1 implementation.**

---

## 12. Gap Analysis — Enum Member Sets

**Method:** Each enum's **member set** was verified against the D1-approved sources only — `[D1]` D1_FOUNDATION_REPORT (especially §6) and `[MS]` Master Specification. `[D1 §1, §3, §6]` states the enumerations match the **Phase 4A shared enumerations**; Phase 4A is *referenced by* `[D1]` but its content is **not contained** in the allowed source set. D2–D9 reports are excluded by instruction. No values were invented.

### A. Included from source — member sets explicitly defined

| Enum | Members | Source |
|------|---------|--------|
| MarketRegime | Bull · Bear · Sideways | `[MS §4]` |
| EngineType | Core · Turbo | `[MS §1, §8]` |
| Direction | Long · Short | `[MS §2, §12–13]` |
| UserRole | Owner · Operator · Viewer | `[MS §20]` |
| TradeClassification | Ultra Golden (=100) · Golden (95–99) · Strong (90–94) · Watchlist (<90) | `[MS §9–§11]` |
| Market | NASDAQ · NYSE | `[MS §2]` |

### B. Missing from source — name present, member set NOT enumerated in any D1-approved source

| Enum | Status in allowed sources | Partial concept reference (not the full enum) |
|------|---------------------------|-----------------------------------------------|
| OrderStatus | name only `[D1 §6]` | "Order Rejected" mentioned `[MS §20]` — a single state, not the set |
| PositionStatus | name only `[D1 §6]` | "Open" via "Max Open Positions" `[MS §14, §17]` — a single state, not the set |
| RiskDecision | name only `[D1 §6]` | none explicit |
| SeverityLevel | name only `[D1 §6]` | none explicit |
| SystemEventType | name only `[D1 §6]` | `system_events` referenced `[MS §19]`; event types not listed |
| AuditEventType | name only `[D1 §6]` | `audit_logs` referenced `[D1 §4]`; event types not listed |

> The partial references in column 3 are isolated single states. Adopting them as the enum definition would be incomplete and misleading, so they are **not** included as member sets.

### C. Requires future definition

The six enums in (B). Per `[D1 §1, §3, §6]`, their authoritative member sets reside in the **Phase 4A shared-enumerations** artifact, which `[D1]` is built to match but which is **not present in the allowed source set**. They are therefore marked **"To be produced during B1 implementation"** — to be obtained by **transcription from the Phase 4A shared-enumerations artifact** (not by invention). Availability of that artifact is a precondition for completing these enums in B1.

**Conclusion:** The "To be produced during B1 implementation" marking on these six enum member sets is **verified correct, not over-aggressive** — the values exist only in Phase 4A / D2–D9, all outside the allowed source set. All other "To be produced" markings in this document (per-model columns, partition keys, retention windows, not-null/uniqueness details, test counts) likewise remain accurate, as those items are not specified in the three sources.

---

**This document is the official build specification for B1 (D1 Foundation),** derived only from the three named sources, with all unspecified items explicitly marked. It contains no code, no SQL, and no implementation.

**STOP.**
