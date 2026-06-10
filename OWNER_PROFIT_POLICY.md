# OWNER_PROFIT_POLICY

**Type:** Owner governance policy record. **Documentation only — no code, no tests, no implementation, no source/schema changes.**
**Status:** **APPROVED & RECORDED** by the owner. Governance policy (not a permanent architectural restriction; not an implementation mandate).
**Supersedes/answers:** `OWNER_PROFIT_POLICY_REVIEW.md` decisions **OP-3** (profit-taking exits), **OP-4** (profit thresholds), **OP-6** (profit reporting).
**Consistent with:** `B9_OWNER_POLICY_UPDATE.md` (forward-only governance; history immutable) · `D14_PAPER_VALIDATION_ARCHITECTURE.md` (profit metrics are gates/reporting, not rules).

**Invariants preserved:** PostgreSQL **sole source of truth** · Redis **non-authoritative** · D3 **Score Engine = single source of truth** · **Portfolio ⟂ Risk ⟂ Execution** intact · **no strategy / risk / execution / allocation / capital-recovery / scoring changes** · no new tables · no new enums · no schema changes · **no modification to D1–D14**.

---

## 1. Policy Statement (approved)

1. **+30% profit is NOT a mandatory take-profit target.**
2. **Winning positions may continue running** while approved exit conditions remain valid.
3. **Trailing-stop and the approved exit methodology remain the primary profit-protection mechanisms.**
4. **No fixed-profit target shall force an exit.**
5. **Profit percentages are reporting metrics only.**
6. **This policy must not modify** strategy, risk, execution, allocation, recovery, or scoring logic.
7. **Any future partial-profit-taking mechanism requires a separate architecture review and explicit owner approval.**

---

## 2. Interpretation & Scope

- **No fixed-target forced exit.** The system shall not close a winning position solely because it reached a fixed profit percentage (e.g., +30%). Exits are governed by the **approved exit methodology** (trailing-stop and the existing approved exit conditions), not by a hardcoded profit target (Rules 1, 4).
- **Let winners run.** A position with unrealized profit continues while its approved exit conditions hold; profit level alone does not trigger an exit (Rule 2).
- **Trailing-stop primacy.** Profit is protected by the **trailing-stop / approved exit methodology** that lives in the existing (frozen) strategy/execution layers — this policy affirms that mechanism as primary and adds nothing new to it (Rule 3).
- **Profit % is reporting only.** Profit percentages (including +30%) are **observational metrics** for reporting/validation (consistent with `D14` and `OWNER_PROFIT_POLICY_REVIEW` §6); they are **never** trading rules and feed **no** exit/risk/sizing decision (Rule 5).
- **No engine change.** This policy is a **governance statement**; it modifies **no** strategy, risk, execution, allocation, capital-recovery, or scoring logic (Rule 6) and triggers **no implementation**.
- **Partial-profit-taking is gated.** Any future mechanism that takes partial profit (scaling out, tiered targets, etc.) is **out of scope** and requires its **own architecture review + explicit owner approval** before any design or code (Rule 7).

---

## 3. What This Policy Does NOT Do

- It does **not** introduce, remove, or alter any exit rule, trailing-stop parameter, profit target, or scoring/risk/allocation behavior.
- It does **not** authorize any code, schema, table, enum, or configuration change.
- It does **not** add a fixed-profit-target feature (it explicitly forbids one forcing an exit).
- It does **not** implement partial-profit-taking (explicitly deferred to a future, separately-approved review — Rule 7).

---

## 4. Relationship to the Frozen Engine (transparency)

- **Profit accounting** (realized/unrealized PnL, cash = `starting_capital + Σ realized PnL`, equity, HWM, drawdown) remains **D6, frozen** — unchanged by this policy.
- **Exit behavior** (trailing-stop / approved exit conditions referenced in Rule 3) resides in the **frozen strategy/execution layers**; this policy affirms it as the governing profit-protection mechanism and changes none of it. Any change to that methodology would itself require formal architecture review (the freeze and Rule 7 discipline apply).
- **Profit metrics** (profit factor, portfolio return, profit %, +30% reporting) are **read-only** per `D14` — Rule 5 aligns exactly with that design.
- **Allocation & capital-recovery** methodology remains frozen (V2-001 fixed allocation; D6/B9 recovery), untouched by this policy.

> Governance/implementation alignment is preserved: this is a policy *record*, not a behavior change. If a future review finds any divergence between the approved exit methodology (Rule 3) and implemented behavior, that is addressed under the standard architecture-review process — not by this document.

---

## 5. Governance Nature

- Classified as an **owner governance policy**, not a permanent architectural restriction (consistent with `B9_OWNER_POLICY_UPDATE` Rules 6–7).
- **Forward-only**; it does not recalculate or alter any historical positions, PnL, audit, performance, or recovery records.
- The owner retains the right, in future versions (V2, V3, …), to revise profit-taking, trailing-stop, or partial-profit policy **through formal architecture review and versioned approval** (Rule 7).

---

## 6. Record

- **Classification:** Owner governance policy — approved & recorded.
- **Effect on v1:** none implemented; engine behavior unchanged; freeze intact.
- **Resolves:** review items OP-3 (no forced profit-taking exits; partial-profit-taking deferred), OP-4 (profit % as gates/reporting), OP-6 (profit reporting exposure governed).
- **Action:** logged as governance. No implementation follows from this document.

---

## 7. Stop Gate

**STOP.**

Documentation only — policy recorded, **no implementation changes**, no source/schema modification, no change to D1–D14 or to strategy/risk/execution/allocation/recovery/scoring logic. Any future partial-profit-taking mechanism requires a separate architecture review and explicit owner approval (Rule 7).
