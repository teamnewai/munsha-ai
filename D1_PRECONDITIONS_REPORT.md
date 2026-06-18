# D1_PRECONDITIONS_REPORT

**Purpose:** Identify every external artifact required to complete **B1 — D1 Foundation** (enums · DB schema · domain models · partition/retention).
**Scope:** Documentation only. No new requirements created. No implementation details. Each item is drawn from artifacts already referenced in the approved pack; nothing is invented.
**Source legend:** `[MS]` Master Specification · `[D1]` D1_Foundation_Report · `[RR]` Implementation_Reset_Report · `[D1S]` D1_Foundation_Specification · `[FI]` Project_File_Index · `[PS]` Project_State_Report.

---

## Summary Table

| # | Artifact | Blocking? | Available / Missing |
|---|----------|-----------|---------------------|
| 1 | **Phase 4A — Shared Enumerations** | **Blocking** | Missing |
| 2 | **Phase 4A — Table / Column Definitions** (schema detail) | **Blocking** | Missing |
| 3 | **Phase 4A — Partition / Retention Detail** (keys, windows) | Non-Blocking* | Missing |
| 4 | **Repository scaffold + Python toolchain** (B0 bootstrap) | **Blocking** | Missing (in-scope to create) |
| 5 | **Approved specification documents** (MS · D1 · RR · D1S) | — (satisfied) | Available |
| 6 | **Original D1–D6 Repository** (`thul-nurayn-repo` + `.tar.gz`) | Non-Blocking | Missing (non-existent) |
| 7 | **Pre-existing SQL Migration Sources** | Non-Blocking | Missing (none exist — B1 produces them) |
| 8 | **THUL-NURAYN-Research-Report** | Non-Blocking | Missing |
| 9 | **Live PostgreSQL instance** | Non-Blocking | Missing (needed at B7) |

\* The *strategy* is already specified `[D1 §7]`; only key-/window-level detail is missing, and that is tied to artifact #2.

---

## Detailed Preconditions

### 1. Phase 4A — Shared Enumerations
- **Why required:** Holds the authoritative **member sets** for the six enums whose values are not in any D1-approved source — `OrderStatus`, `PositionStatus`, `RiskDecision`, `SeverityLevel`, `SystemEventType`, `AuditEventType`. B1 cannot finalize these enums without it (and inventing members is forbidden).
- **Source document that references it:** `[D1 §1, §3, §6]` ("التعدادات المشتركة … مطابقًا لـ Phase 4A"); `[D1S §2, §12]`.
- **Blocking:** **Blocking** (for enum completion).
- **Available / Missing:** **Missing** — referenced by `[D1]` but not contained in the pack.

### 2. Phase 4A — Table / Column Definitions (schema detail)
- **Why required:** `[D1 §3]` states the **19 tables "match Phase 4A"** but enumerates only table names + high-level constraints (UUID PKs, FK `ON DELETE RESTRICT`, enum CHECKs, index targets). The authoritative **column-level definitions** (names, datatypes, nullability) live in Phase 4A. Required to produce `001_init_schema.sql` faithfully (no invention).
- **Source document that references it:** `[D1 §3]`; `[D1S §4, §6]`.
- **Blocking:** **Blocking** (for full schema).
- **Available / Missing:** **Missing**.

### 3. Phase 4A — Partition / Retention Detail
- **Why required:** The partition **scheme** (monthly RANGE on 6 named tables) and retention **tiering** (Hot→Warm→Cold; audit/back-test archived, not deleted) are already specified `[D1 §7]`. What remains in Phase 4A: the **partition key column per table** and any concrete **retention windows**.
- **Source document that references it:** `[D1 §1, §7]`; `[D1S §7, §8]`.
- **Blocking:** **Non-Blocking** for the strategy itself; the missing key-level detail depends on artifact #2.
- **Available / Missing:** **Missing** (strategy available; key/window detail missing).

### 4. Repository scaffold + Python toolchain (B0 bootstrap)
- **Why required:** B1 produces `src/enums`, `src/models`, `db/…`, and `tests/` and must run unit tests. This requires the repository initialized and the Python lint/type-check/test toolchain in place.
- **Source document that references it:** `[RR §3]` (Phase B0); `[D1 §2]` (repository tree).
- **Blocking:** **Blocking** (B1 cannot be built/tested without it).
- **Available / Missing:** **Missing** — but this is an **in-scope bootstrap (B0)**, not a third-party dependency; it precedes B1 within the project.

### 5. Approved specification documents
- **Why required:** Source of truth for B1 — the enum/model/table/relationship/constraint rules and the B1 Definition of Done.
- **Source document that references it:** `[FI]` (file index); used throughout `[D1S]`.
- **Blocking:** — (precondition **satisfied**).
- **Available / Missing:** **Available** — `MS`, `D1`, `RR`, `D1S` are all present.

### 6. Original D1–D6 Repository (`thul-nurayn-repo` + `.tar.gz`)
- **Why required (per original pack):** Listed as the implemented/tested D1–D6 code base.
- **Status correction:** `[RR §1]` records that **no such repository or code exists**; THUL-NURAYN v1 is architecture-complete, implementation-not-started. B1 is therefore re-based to build the foundation **from scratch**, so it does **not** depend on this artifact.
- **Source document that references it:** `[FI]`, `[PS]`; corrected by `[RR §1]`.
- **Blocking:** **Non-Blocking** for B1.
- **Available / Missing:** **Missing (non-existent).**

### 7. Pre-existing SQL Migration Sources
- **Why required:** Would only be a precondition if an earlier schema existed to import/migrate from.
- **Status:** Per `[RR §1]` no prior code/SQL exists; the migration artifacts (`001_init_schema.sql`, `partition_retention.sql`) are **B1 deliverables**, produced under `[D1S]` against the Phase 4A definitions (artifact #2) — they are outputs, not external inputs.
- **Source document that references it:** `[D1 §2]` (filenames); `[D1S §1, §4]`.
- **Blocking:** **Non-Blocking** (deliverable, not a prerequisite).
- **Available / Missing:** **Missing** (none exist; to be produced).

### 8. THUL-NURAYN-Research-Report
- **Why required:** Upstream evidence base for strategy thresholds.
- **Why not required for B1:** D1 Foundation contains **no thresholds or strategy logic** `[D1 §1]`; threshold values belong to later domains. So B1 does not consume it.
- **Source document that references it:** `[FI]` (dependency map: Research-Report → Master Specification).
- **Blocking:** **Non-Blocking** for B1.
- **Available / Missing:** **Missing**.

### 9. Live PostgreSQL instance
- **Why required (later):** To apply the schema against a real database.
- **Why not required for B1:** Applying the schema to a live PostgreSQL is **B7**, not B1; B1 validation is offline with no network, and live apply has "no effect on foundation validity" `[D1 §10]`, `[RR §3, §6]`, `[D1S §10]`.
- **Source document that references it:** `[D1 §10]`; `[RR §3, §6]`.
- **Blocking:** **Non-Blocking** for B1.
- **Available / Missing:** **Missing** (not provisioned).

---

## Readiness Conclusion (for B1)

- **Can begin now (no missing artifact):** repository structure, enum **names**, model **names**, the six **fully-defined** enums (MarketRegime, EngineType, Direction, UserRole, TradeClassification, Market), the explicit relationships/cardinalities, high-level constraints, the partitioned-table list, and the retention tiering — all present in `[MS]`/`[D1]`/`[D1S]`. Requires the B0 bootstrap (artifact #4) first.
- **Cannot be completed without delivery of one artifact — Phase 4A** (artifacts #1 + #2): the **six enum member sets** and the **column-level table definitions**. These are the single hard blocker; without Phase 4A they cannot be produced without invention, which is prohibited.
- **All other missing items** (#6, #7, #8, #9) are **Non-Blocking** for B1.

> **Net:** B1 is **partially startable** but **not completable** until the **Phase 4A** artifact (shared enumerations + table/column definitions) is supplied, and the **B0 bootstrap** is in place.

---

*Documentation only. No new requirements, no implementation details.*

**STOP.**
