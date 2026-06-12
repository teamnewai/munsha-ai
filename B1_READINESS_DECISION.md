# B1_READINESS_DECISION

**Decision document for: B1 — D1 Foundation.**
**Basis:** `[MS]` Master_Specification · `[D1]` D1_Foundation_Report · `[RR]` Implementation_Reset_Report · `[D1S]` D1_Foundation_Specification · `[P4A]` Phase_4A_Recovery_Report.
**Type:** Documentation only. No code. No SQL. No implementation.

---

## 1. Can B1 start?

**Yes — B1 can start.** Per `[P4A]`, the only artifact previously flagged as a hard blocker (Phase 4A) is **missing as a document but recoverable in substance**, and the single residual gap (per-column table schema) is already designated an **in-B1 design task** `[D1S §4]` — not an external dependency.

A distinction governs this decision:
- **Start** = begin producing D1 deliverables → **unblocked.**
- **Complete** = finalize all enum members + column schema → requires the owner approvals in §5 (relaxing the D1-only source rule, and authorizing the schema design). These are **governance actions, not missing artifacts.**

The only true precondition to *begin* is the **B0 bootstrap** (repository scaffold + Python toolchain) `[RR §3]` — an in-scope setup step, not a third-party dependency.

---

## 2. What is frozen and known

Available now from the approved pack (no invention, no Phase 4A document needed):

| Item | Status | Source |
|------|--------|--------|
| Enum **names** (12) | Frozen / known | `[D1 §6]` |
| 6 fully-defined enum member sets — MarketRegime, EngineType, Direction, UserRole, TradeClassification, Market | Frozen / known | `[MS §1,§2,§4,§9–11,§12–13,§20]` |
| 6 recovered enum member sets — OrderStatus, PositionStatus, RiskDecision, SeverityLevel, SystemEventType, AuditEventType | Known (embedded; adoption pending §5a) | `[P4A]` ← `[D4]`/`[D5]`/`[D8]` |
| 19 table **names** (17 entities + 2 bridges) | Frozen / known | `[D1 §3]` |
| High-level constraints — UUID PKs, FK `ON DELETE RESTRICT`, enum CHECK, index targets (sector/state/classification/engine/time) | Frozen / known | `[D1 §3]` |
| Relationships + cardinalities (Order 1─\* Fill, Fill \*─1 Position, Order \*─1 Position, Signal↔Score 1:1, Signal↔RiskCheck 1:1; bridges; append-only audit) | Frozen / known | `[D1 §4]`, `[MS §20]` |
| Global field typing — Decimal money, UUID ids, tz-aware UTC timestamps; VIX/State nullable | Frozen / known | `[D1 §5]` |
| Partition strategy — monthly RANGE on signals/orders/audit_logs/system_events/market_snapshots/risk_snapshots | Frozen / known | `[D1 §7]` |
| Retention tiering — Hot→Warm→Cold; audit/back-test archived, not deleted | Frozen / known | `[D1 §7]` |
| B1 Definition of Done + Stop Gate | Frozen / known | `[RR §3,§6]`, `[D1 §11]`, `[D1S §11]` |

---

## 3. What must be designed during B1

Items not specified in any approved document, to be **authored during B1** (and recorded):

1. **Per-column table definitions** — column names, datatypes, nullability for each of the 19 tables. `[P4A]` confirms this is the one element absent from every pack document. `[D1S §4]` already marks it "to be produced during B1."
2. **Partition key column** per partitioned table (derives from #1) `[D1S §7]`.
3. **Exact identifier spellings** of enum members `[D1S §2]`.
4. **Not-null / uniqueness / default details** beyond the high-level constraints `[D1S §6]`.
5. **D1 test cases, counts, fixtures, file layout** `[D1S §10]`.

These are **design-and-build tasks**, not inventions of new rules — they implement the known structure.

---

## 4. What is forbidden to invent

Per FROZEN policy `[MS]`, `[D1S]`, `[P4A §Governance]`:

- **Enum members** — must be **transcribed** from approved sources (`[MS]` for the 6 defined; `[D4]`/`[D5]`/`[D8]` for the 6 recovered, pending §5a). **Never invented or guessed.**
- **New tables, enums, columns-as-rules, or relationships** beyond the 19 tables / 12 enums / stated relationships.
- **Thresholds, weights, risk limits, scoring, classification bands** — frozen `[MS]`; and out of D1 scope entirely (no strategy logic in D1) `[D1 §1]`.
- **Retention windows / RPO-RTO numbers** — not specified; not to be invented (operationally defined later) `[D1S §8]`.
- **Any value not present in an approved source.** Where a value is genuinely absent, it is a **design decision to be documented**, not an invented requirement.
- **Any out-of-scope behavior** — Scanner / Score / Risk / Execution / Portfolio / Broker / API / UI logic `[D1 §1]`.

---

## 5. Owner approvals required

| # | Approval | Why needed | Source |
|---|----------|-----------|--------|
| **5a** | **Adopt the 6 recovered enum member sets from D4/D5/D8** into the D1 enum spec | Recovering them relaxes the earlier strict "D1-only / no D2–D9" rule for `[D1S]`. Values are authoritative within the frozen pack (not invented), but adopting them is the owner's call. | `[P4A §Conclusion 4]` |
| **5b** | **Authorize authoring the per-column table schema during B1** | The one residual gap; no document specifies it. Designing it in B1 is the recommended path. | `[P4A §5]`, `[D1S §4]` |
| **5c** | **Approve the B0 bootstrap and repository target** (scaffold + Python toolchain; confirm THUL-NURAYN repo destination) | Required to begin and to run D1 tests. | `[RR §3]` |
| **5d** | **Stop-Gate approval before B2** | Standard gate after B1 completes; B2 (Data Access) must not begin without it. | `[D1 §11]`, `[RR §3]` |

> 5a and 5b gate **completion**; 5c gates **start**. 5d gates **the next phase**.

---

## B1 START DECISION:

# YES

*(Conditional on the owner granting approvals 5a–5c; B1 may begin upon 5c, and complete upon 5a + 5b.)*

### Exact first B1 deliverables

Produced under `[D1S]` and `[RR §6]` (no code/SQL now — these are what B1 will deliver):

1. **`src/enums/`** — the **12 enumerations** with members:
   - 6 transcribed from `[MS]`: MarketRegime, EngineType, Direction, UserRole, TradeClassification, Market.
   - 6 transcribed from the recovered sources (per 5a): OrderStatus, PositionStatus, RiskDecision, SeverityLevel, SystemEventType, AuditEventType.
2. **`src/models/`** — the **17 entity models + 2 bridge models** as dataclasses (Decimal / UUID / tz-aware; VIX/State nullable).
3. **`db/migrations/001_init_schema.sql`** — the **19 tables**, with per-column schema authored in B1 (per 5b), UUID PKs, FK `ON DELETE RESTRICT`, enum CHECK constraints, and indexes on the stated hot lookups.
4. **`db/partitions/partition_retention.sql`** — monthly RANGE partitions on the 6 named tables; Hot→Warm→Cold retention; audit/compliance never deleted.
5. **`tests/`** — D1 unit tests: enum integrity, model construction/typing, schema-constraint expectations (offline, no network).
6. **Documentation** — a change-log entry in `docs/CHANGE_REQUESTS/` recording the schema-design decisions (5b) and the enum-recovery adoption (5a); this decision file is the recorded basis.

**Then:** Stop Gate — halt for owner review/approval before B2 (Data Access) `[D1 §11]`.

---

*No code. No SQL. No implementation.*

**STOP.**
