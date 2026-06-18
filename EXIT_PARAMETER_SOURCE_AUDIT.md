# EXIT_PARAMETER_SOURCE_AUDIT

**Type:** Source audit. **No recommendations. No new values. No implementation. No code/architecture/schema change.**
**Status:** **COMPLETE — awaiting owner review.** Requested before any decision in `EXIT_PARAMETER_DECISION_REPORT.md` is ratified.
**Question answered:** Do any **already-approved** exit parameters exist for Core trailing stop, Core hard stop, Turbo trailing stop, Turbo hard stop, or Turbo session close — anywhere in the THUL-NURAYN specifications, master specifications, architecture documents, owner policies, or frozen documents present in this repository?

---

## 0. Method & corpus searched

- **Corpus:** all 100 `*.md` documents tracked in the repository (full `find` enumeration), plus the `thul-nurayn/docs` directory and all source under `thul-nurayn/src`.
- **Search terms (case-insensitive, with context):** `trailing`, `trail`, `hard stop`, `hard-stop`, `stop loss`, `stop-loss`, `session close`, `EOD`, `end of day`, `go flat`, `flat by`, `overnight`, `intraday`, `ATR`, `chandelier`, `volatility stop`, `take profit`, `profit target`, `+30`, `30%`, `hold time`, `holding period`, `time stop`, `max hold`, `days in trade`.
- **Exclusions:** the three documents I authored in this exit workstream (`EXIT_CLOSE_ARCHITECTURE.md`, `EXIT_PARAMETER_DECISION_REPORT.md`, `OR2_EXIT_PATH_BLOCKER.md`) are **not** treated as sources of approved parameters — they are the requests/analysis, not approved spec.

### 0.1 Threshold finding about the Master Specification itself
The authoritative **`THUL-NURAYN_v1_MASTER_SPECIFICATION.md`** — described across the corpus as the *single source of truth* with *"20 sections"* (`DOCUMENT_VERIFICATION_REPORT.md:18`) and cited as "Derived from" by B6/B7/B8/D11 and others — **is NOT present in this repository.** Verified two ways:
- `git ls-files | grep -i master` → only `D1_FOUNDATION_SPECIFICATION.md` (a D1 enum/schema spec, not the Master Spec).
- `ls THUL-NURAYN_v1_MASTER_SPECIFICATION.md` → *No such file or directory.*

**Consequence:** the Master Specification's *full text cannot be audited from this repository.* What the repository *does* contain is the **faithful transcription of the Master Spec's frozen strategy invariants** in the `PROJECT_STATE_CHECKPOINT*` files (which state, e.g., "all thresholds, weights, bands, limits, regime rules, state machines, and invariants match §1–§20" — `PROJECT_STATE_CHECKPOINT.md:153`). That transcription is the best in-repo proxy for "what the Master Spec froze," and it is audited below.

---

## 1. Per-parameter findings

### 1.1 Core trailing stop
- **Found / Not Found:** **NOT FOUND.**
- **Exact document:** No document in the repository states a Core trailing-stop type or value. The closest references are governance affirmations that a trailing-stop *methodology* exists, with **no parameter**:
  - `OWNER_PROFIT_POLICY.md`
  - `OWNER_PROFIT_POLICY_REVIEW.md`
- **Exact section:** `OWNER_PROFIT_POLICY.md` §1 (Policy Statement) and §4 (Relationship to the Frozen Engine).
- **Exact wording:**
  - §1.3: *"Trailing-stop and the approved exit methodology remain the primary profit-protection mechanisms."*
  - §3: *"It does **not** introduce, remove, or alter any exit rule, trailing-stop parameter, profit target, or scoring/risk/allocation behavior."*
  - §4: *"Exit behavior (trailing-stop / approved exit conditions referenced in Rule 3) resides in the frozen strategy/execution layers; this policy affirms it as the governing profit-protection mechanism and changes none of it."*
- **Binding?** The *principle* (trailing-stop is the primary mechanism; no fixed profit target) is **binding** (approved owner policy). **No Core trailing-stop type or numeric value is stated, so there is no binding Core trailing-stop parameter to apply.** The frozen-invariants transcription (`PROJECT_STATE_CHECKPOINT_B6.md:110-134`) lists Selection thresholds, Risk Limits, State Machine Rules, Regime, and Kill Switch — and contains **no trailing-stop entry**.

### 1.2 Core hard stop
- **Found / Not Found:** **NOT FOUND.**
- **Exact document:** None. The term "hard stop" / "hard-stop" returns **zero matches** anywhere in the corpus (outside the exit-workstream docs I authored). "stop-loss" appears once, and only to say it does **not** exist in v1:
  - `D14_PAPER_VALIDATION_ARCHITECTURE.md`
- **Exact section:** `D14_PAPER_VALIDATION_ARCHITECTURE.md` §Risks/Open-Decisions (item on R-multiple), line 151.
- **Exact wording:** *"R-multiple has no native basis in v1 (no stop-loss/risk amount persisted; fixed allocation, no risk-based sizing — V2-001). True R-multiple is not computable from existing data."*
- **Binding?** This is a **binding statement of absence**: it affirms that **no stop-loss / risk amount exists or is persisted in v1.** There is therefore **no approved Core hard-stop parameter.**

### 1.3 Turbo trailing stop
- **Found / Not Found:** **NOT FOUND.**
- **Exact document:** None. No document states a Turbo trailing-stop type or value. The only Turbo-specific `ATR` references are **selection/scan eligibility thresholds, not exits**:
  - `PROJECT_STATE_CHECKPOINT_B6.md`, `PROJECT_STATE_CHECKPOINT.md`, `MARKET_DATA_FIXTURE_ARCHITECTURE.md`, `B3_*`.
- **Exact section:** `PROJECT_STATE_CHECKPOINT_B6.md` §6 "Architectural Invariants → Project & Domain / Selection thresholds" (lines 116, 120).
- **Exact wording:**
  - *"Market universe: … Turbo ATR ≥ $0.50"* (eligibility to be **scanned**, not an exit).
  - *"Selection thresholds: RS 80/90 · RVOL Core 1.5/2.0, Turbo 3.0 · Gap 4% · ATR $0.50 · ADV 500k · Premkt 100k · PEAD ≤ 10 days"* (all **entry-selection** thresholds).
- **Binding?** The ATR $0.50 figure is **binding — but as a Turbo *entry-selection* gate, not as an exit/trailing parameter.** It must **not** be repurposed as a trailing-stop value. **No Turbo trailing-stop parameter exists.**

### 1.4 Turbo hard stop
- **Found / Not Found:** **NOT FOUND.**
- **Exact document:** None ("hard stop" = zero matches; the v1 "no stop-loss" statement in `D14_PAPER_VALIDATION_ARCHITECTURE.md:151` applies to both engines).
- **Exact section:** `D14_PAPER_VALIDATION_ARCHITECTURE.md:151`; corroborated by `OWNER_PROFIT_POLICY_REVIEW.md` §C / OP-3.
- **Exact wording:**
  - `OWNER_PROFIT_POLICY_REVIEW.md` §C: *"Profit-taking exit logic — any 'take profit at X / trail by Y' rule is strategy/execution and is **frozen**; introducing it is a **V2_BACKLOG** item requiring formal architecture review and versioned approval."*
  - `OWNER_PROFIT_POLICY_REVIEW.md:44`: *"No profit-taking exit rule is part of the v1 score/risk/execution logic … the exit decision is strategy and is **not parameterized for profit targets in v1**."*
- **Binding?** **Binding statement of absence.** No approved Turbo hard-stop parameter exists.

### 1.5 Turbo session close (intraday flat / no-overnight)
- **Found / Not Found:** **NOT FOUND** (as an *exit/flattening rule*).
- **Exact document:** "Intraday" appears only as a **scan/refresh *cadence*** descriptor, never as a position-flattening rule:
  - `P-ORCH_PIPELINE_ORCHESTRATOR_ARCHITECTURE.md`, `P_DATA_MARKET_DATA_ARCHITECTURE.md`, `P-DEPLOY_ARCHITECTURE.md`.
- **Exact section:** `P-ORCH_PIPELINE_ORCHESTRATOR_ARCHITECTURE.md` OD-PORCH-4 (line 121, 270).
- **Exact wording:** *"Cadence (OD-PORCH-4): Core (swing) on an EOD/daily cycle; Turbo (intraday) on a minute-level cycle — aligned to P-DATA's refresh and the America/New_York market session. Market-closed cycles are no-ops."*
- **Binding?** The **cadence** ("Turbo runs on a minute-level intraday cycle; market-closed cycles are no-ops") is **binding** — but it governs **when the pipeline scans/refreshes**, **not** whether open Turbo positions are force-closed at session end. **No approved rule states that Turbo positions are flattened at session close (or held overnight).** The session-close *exit* policy is undefined in every in-repo document.

---

## 2. Summary table

| Parameter | Found? | Exact document | Exact section | Binding status |
|---|---|---|---|---|
| **Core trailing stop** | **NOT FOUND** (value/type); methodology *referenced* only | `OWNER_PROFIT_POLICY.md` | §1.3, §3, §4 | Principle binding; **no parameter** |
| **Core hard stop** | **NOT FOUND** | `D14_PAPER_VALIDATION_ARCHITECTURE.md` | line 151 ("no stop-loss … persisted") | Binding **absence** |
| **Turbo trailing stop** | **NOT FOUND** (ATR $0.50 is a *selection* gate, not an exit) | `PROJECT_STATE_CHECKPOINT_B6.md` | §6 Selection thresholds (l.116,120) | ATR binding **for entry only**; no exit param |
| **Turbo hard stop** | **NOT FOUND** | `OWNER_PROFIT_POLICY_REVIEW.md` / `D14_PAPER_VALIDATION_ARCHITECTURE.md` | §C / OP-3 ; line 151 | Binding **absence** |
| **Turbo session close** | **NOT FOUND** (only *cadence*, not a flatten rule) | `P-ORCH_PIPELINE_ORCHESTRATOR_ARCHITECTURE.md` | OD-PORCH-4 (l.121,270) | Cadence binding; **no flatten rule** |

---

## 3. Corroborating facts (transparency)

1. **Frozen-invariants transcription contains no exit parameters.** `PROJECT_STATE_CHECKPOINT_B6.md` §6 enumerates the locked v1 set — Market universe, Engines, Classification bands, Score weights, Selection thresholds, Risk Limits, State Machine Rules, Market Regime, Kill Switch — and **none** is an exit/trailing/hard-stop/session-close parameter. The position state machine entry is structural only: *"Position: `Open→Closed` (`Closed→Open` forbidden)"* — it says a position *can* close, not *when*.
2. **Risk Limits are exposure/loss *governors*, not exits.** *"Max Open 5 · Max Trades/Day 5 · Daily DD −3% · Weekly DD −6% · Monthly DD → Pause · Consecutive Loss 3 · Sector ≤ 25% · Capital 70/30"* — these pause/limit **new** activity; none closes an **existing** position.
3. **Source code confirms the documentary finding.** Prior source verification (recorded in `OR2_EXIT_PATH_BLOCKER.md` / `EXIT_CLOSE_ARCHITECTURE.md`) found **zero** exit/trailing/stop logic or constants in `thul-nurayn/src`. Documents and code agree: the parameters are absent.
4. **A governance tension the owner should note (not resolved here):** `OWNER_PROFIT_POLICY_REVIEW.md` OP-3 and §C classify *any* "trail by Y / take profit at X" exit rule as **frozen → V2_BACKLOG, "Do not add in v1."** The subsequently approved `EXIT_CLOSE_ARCHITECTURE.md` (Option A) authorizes building the exit/close leg in v1. These are reconcilable only by an explicit owner ruling that the exit/close work is the sanctioned in-v1 exception to OP-3. **This audit only flags the tension; it does not resolve it.**

---

## 4. Conclusion

For all five requested parameters — **Core trailing stop, Core hard stop, Turbo trailing stop, Turbo hard stop, Turbo session close — no approved value or rule exists in any specification, architecture document, owner policy, or frozen document present in this repository.**

What exists is:
- a **binding principle** that a trailing-stop methodology is primary and no fixed profit target may force an exit (`OWNER_PROFIT_POLICY`), and
- **binding statements of absence** that v1 persists no stop-loss/risk amount and is "not parameterized for profit targets in v1" (`D14_PAPER_VALIDATION_ARCHITECTURE`, `OWNER_PROFIT_POLICY_REVIEW`).

The authoritative **`THUL-NURAYN_v1_MASTER_SPECIFICATION.md` is not present in this repository**, so whether *it* contains the exit parameters **cannot be determined from here** and must be checked against the **owner's copy of the Master Specification**. If the owner's Master Spec does contain them, they should be transcribed verbatim; if it does not, the parameters are genuinely undefined and require an explicit owner decision (per `EXIT_PARAMETER_DECISION_REPORT.md`) before EX-1.

---

## 5. Stop gate

**STOP — audit only. Awaiting owner review.**

No values recommended, no decisions made, no code/architecture/schema change. EX-1…EX-5 and OR-2 remain paused. The single most important next input is the owner's confirmation of whether the **owner-held Master Specification** contains exit parameters for these five items.
