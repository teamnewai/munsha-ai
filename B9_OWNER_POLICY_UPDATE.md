# B9_OWNER_POLICY_UPDATE

**Type:** Owner governance policy record. **Documentation only — no code, no tests, no implementation, no source/schema changes.**
**Status:** Governance policy (not a permanent architectural restriction; not an implementation mandate).
**Recorded against project state:** B1–B8 approved/frozen; B9 architecture approved with ratified decisions D1–D6 (`ab462c8`).
**Authority:** Owner.

---

## 1. Policy Statement

**Starting Capital** and **Position Allocation** are **configurable account settings**, subject to the change-window, forward-only, and historical-immutability rules below. This is recorded as an **owner governance policy**, not a permanent architectural constraint and not a freeze on future development.

---

## 2. Definitions

| Term | Meaning in this policy |
|------|------------------------|
| **Starting Capital** | The account's base capital figure used by the portfolio layer (D6) to derive cash/equity. Today sourced from Environment/Configuration (ratified decision **D1**). |
| **Position Allocation** | The configurable allocation figure governing how much capital a trade may use. Today v1 applies a **fixed allocation methodology** (fixed 10%/trade; risk-based position sizing is deferred as **V2-001**). This policy makes the **value** an account setting; it does **not** change the allocation **methodology**. |
| **Trading session** | The US-equities (NASDAQ/NYSE) market session. |
| **After-Hours close** | The end of the after-hours trading window for the session. |

---

## 3. Governance Rules (verbatim intent)

1. **Users may change:** Starting Capital · Position Allocation.
2. **Changes are allowed only:**
   - **Before** the trading session starts, **OR**
   - **At least 30 minutes after** After-Hours close.
   (Changes are **prohibited** during the session and within 30 minutes after After-Hours close.)
3. **Changes affect future trades only.**
4. **Historical records must never be recalculated.** This applies to:
   - Positions
   - PnL
   - Audit records
   - Performance records
   - Recovery records
5. **Current methodologies remain unchanged:** strategy rules, risk rules, execution rules, capital recovery methodology, and portfolio formulas are **not** altered by this policy.
6. **This policy does NOT freeze future development.** The owner retains the right, in future versions (V2, V3, …), to modify capital-management policies, allocation policies, recovery policies, and risk methodologies — **through formal architecture review and versioned approval**.
7. **This is an owner governance policy**, not a permanent architectural restriction.

---

## 4. Consistency With Existing Invariants

This policy is consistent with, and does not violate, the frozen v1 invariants:

- **PostgreSQL remains the sole source of truth; Redis remains non-authoritative.**
- **Portfolio ⟂ Risk ⟂ Execution** separation is intact — settings are inputs; D6 computes, D4 decides, D5 executes, unchanged.
- **Historical immutability is already structurally guaranteed:** `audit_logs` and `system_events` are append-only (D2/B7); performance records are written, not rewritten; B9 recovery is **read-only and non-destructive** (ratified **D5**: Alert + DLQ + Continue — never recalculates or mutates historical rows). Rule 4 is therefore aligned with the system as already built.
- **Forward-only effect (Rule 3)** matches the capital/recovery model: cash = starting_capital + cumulative realized PnL is computed from persisted facts; changing a setting changes only how **future** trades are evaluated, never the recorded past.
- **Capital recovery methodology unchanged (Rule 5)** — the D6/B9 rebuild replays persisted positions deterministically; this policy adds no recalculation path.

---

## 5. Relationship to Ratified B9 Decisions

| Ratified decision | Relationship to this policy |
|-------------------|-----------------------------|
| **D1** — Starting Capital = Environment/Configuration | This policy classifies Starting Capital as a configurable account setting. The *source/mechanism* (env/config) is unchanged for the current version; making it **user-editable with a change window** is a future-version concern (see §6). |
| **V2-001** — no risk-based position sizing in v1 (fixed 10%/trade) | This policy makes Position Allocation a configurable **value**; it does **not** introduce risk-based sizing or change the fixed-allocation **methodology**. Any methodology change remains V2+ via formal review. |
| **D5** — recovery = Alert + DLQ + Continue (non-destructive) | Directly satisfies Rule 4 (historical records never recalculated). |

---

## 6. Implementation Status & Scope Boundary

- **This document is governance only.** It records owner intent. It is **not** an instruction to implement user-editable settings, a settings UI/API, a change-window enforcer, or settings persistence in the current version.
- **No part of this policy authorizes**, by itself, any new table, column, enum, schema change, or modification to D1–D8. The current v1 freeze and the approved B9 architecture (which is wiring + read-only recovery) remain in force.
- **Any implementation** of user-editable Starting Capital / Position Allocation — including how the change window (before session OR ≥30 min after After-Hours close) is enforced, how settings are stored and versioned, and how setting changes are audited — **requires its own architecture review and versioned approval** (per Rule 6) before any code is written.

---

## 7. Open Items for a Future Architecture Review (non-binding)

Recorded so the future review (V2+) has a starting checklist. **None of these is authorized or scheduled by this document.**

1. **Settings storage & versioning** — where editable settings live and how prior values are retained for audit, without recalculating history (Rule 4). May require a schema decision → versioned approval.
2. **Change-window enforcement** — a deterministic check against the America/New_York session calendar (consistent with ratified **D2**), including the "≥30 minutes after After-Hours close" rule and explicit session-calendar source.
3. **Change auditing** — recording each setting change (who/when/old→new) using existing append-only mechanisms (e.g., `audit_logs` `SettingRiskChange`) vs. a new structure → review decision.
4. **Forward-only application point** — confirming the exact pipeline point at which a changed setting takes effect for future trades only, preserving Portfolio ⟂ Risk ⟂ Execution.
5. **Position Allocation semantics** — whether configurability remains a fixed-percentage value (v1 methodology) or evolves toward risk-based sizing (V2-001) — strictly a versioned methodology decision.

---

## 8. Record

- **Classification:** Owner governance policy.
- **Effect on v1:** None implemented; v1 behavior unchanged; freeze and B9 architecture intact.
- **Effect on future versions:** Owner may revise capital/allocation/recovery/risk policies via formal architecture review and versioned approval.
- **Action:** Logged as governance. No implementation follows from this document.

**END — documentation only.**
