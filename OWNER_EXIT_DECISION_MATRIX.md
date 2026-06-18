# OWNER_EXIT_DECISION_MATRIX

**Type:** Owner decision matrix. **No implementation. No code. No parameter values invented. No implementation design.**
**Status:** **OPEN — awaiting owner decisions.** Converts the ratified exit direction into the remaining decisions that still require owner approval before EX-1.
**Builds on:** `EXIT_CLOSE_ARCHITECTURE.md` (approved `7592167`) · `EXIT_PARAMETER_DECISION_REPORT.md` · `EXIT_PARAMETER_SOURCE_AUDIT.md` (no exit values exist in-repo) · `EXIT_PHILOSOPHY_REVIEW.md`.

---

## 0. Owner direction now ratified (CLOSED — recorded for traceability, not re-opened)

| Item | Ratified direction |
|---|---|
| **Core philosophy** | Structure/Trend exit · Winners run · No fixed profit target · **Hard-stop protection only** |
| **Turbo philosophy** | Hard stop · Break-even protection · Trailing stop · **Mandatory session-close flatten** |
| Closes | **Full close only · No partial profit-taking** |
| Symmetry | **Long/Short symmetry** |
| Gap-through-stop | **Fills at actual market price** |
| Kill-switch | **Exits allowed during L1–L3** (⇒ L4 halts all activity, per `EXIT_CLOSE_ARCHITECTURE` R-3/OD-E1) |

These are treated as decided. The matrix below lists **only the decisions that remain open** and that must be resolved before implementation. No values are proposed; recommendations are *philosophy/structure* choices or *which existing definition to reuse*.

---

## A. Core (Structure/Trend exit + hard-stop-only) — open decisions

### C-1 — Core structure/trend **exit reference**
- **Decision required:** Which existing, already-approved signal(s) define "the Core thesis has broken" (the trigger to close a winner)?
- **Why it matters:** Core has *no fixed target* and *winners run*, so the **only** profit-side exit is the structure/trend break. Its definition *is* the Core exit.
- **Impact:** Drives profit factor (how long winners run) and win rate (how much open profit is given back before confirming the break). The single biggest determinant of Core results.
- **Available options (all reuse existing definitions — none invented):**
  - **(a)** `trend_stage2` no longer holds (price > 50 > 150 > 200, SMA200 rising — `facts.py:60`).
  - **(b)** Bull regime flip (SPY leaves Bull: SPY < SMA200 × 0.99 — the inverse of the entry gate).
  - **(c)** Breakout failure (loss of the 52-week-high / base level from `BreakoutFacts`).
  - **(d)** A combination (e.g., close when *either* trend-stage breaks *or* regime flips).
- **Recommendation:** **(d) combination of (a) trend-stage break and (b) regime flip**, reusing the exact entry definitions inverted. It is the most faithful "thesis intact → thesis broken" mapping and honors winners-run. **Owner to confirm which signal(s) constitute the break.**

### C-2 — Core hard-stop **basis**
- **Decision required:** On what basis is the Core protective hard stop measured?
- **Why it matters:** It is the downside floor protecting the −10% drawdown gate; its basis must be computable from data Core actually has.
- **Impact:** Determines drawdown control and feasibility.
- **Available options:**
  - **(a)** Percentage of entry price (computable from marks alone — no new data).
  - **(b)** Structure level (e.g., below the breakout/base level — reuses `BreakoutFacts` but needs per-cycle recomputation → see C-3).
  - **(c)** ATR-multiple — **INFEASIBLE for Core as-is:** `CoreCandidateInput` carries **no `atr` field** (`facts.py:51-62`; ATR exists only on `TurboCandidateInput`). Would require new Core data.
- **Recommendation:** **(a) percentage-of-entry** for the protective floor (deterministic, zero new data), with the *value* an owner/Master-Spec decision. Consider (b) only if C-3's data path is funded. **(c) is not available without new Core data.**

### C-3 — Core structure-exit **data-path funding** *(the pivotal Core feasibility gate)*
- **Decision required:** Fund a per-cycle data path that recomputes Core trend/structure facts (`trend_stage2`, regime, breakout level) for **open positions** each cycle — yes or no?
- **Why it matters:** Those facts are computed **at scan time for candidates only**; the per-cycle frame for an open position carries **price marks only** (`frame.py:54`). A true structure exit (C-1 a/c) **cannot be evaluated** without this path. This is a **data-architecture/schema phase**, separate from EX-1.
- **Impact:** If funded → faithful Core structure exit. If not funded → Core structure exit is limited to what is derivable from marks + the already-computed market regime (option C-1b, which uses SPY/SMA200 regime that the pipeline already establishes per cycle), and the trend-stage/breakout triggers (C-1 a/c) are **not implementable**.
- **Available options:**
  - **(a)** Fund the data-path phase → full structure exit (C-1 a/c/d available).
  - **(b)** Do not fund → Core exit restricted to **regime-flip (C-1b) + percentage hard stop (C-2a)**, both computable today.
- **Recommendation:** **Owner choice — genuine fork.** If faithful trend-following Core is the priority, **(a)**. If a v1 campaign without a new schema phase is the priority, **(b)** is implementable now and still honors winners-run via regime (winners run until Bull ends). **No recommendation imposed; this is a scope/strategy trade-off only the owner can make.**

### C-4 — Core hard-stop **actionability under EOD cadence**
- **Decision required:** Is the Core hard stop evaluated on the **EOD/daily close** (Core's cadence), or does the owner fund intraday monitoring for Core open positions?
- **Why it matters:** Core runs EOD (`P-ORCH` OD-PORCH-4). A hard stop checked only at the daily close means an intraday plunge **through** the stop is not acted on until the close → **overnight/gap loss** can exceed the intended stop.
- **Impact:** Determines whether the drawdown floor is "soft" (close-based) or "hard" (intraday). Affects the −10% gate's reliability for Core.
- **Available options:**
  - **(a)** Close-based stop on the EOD cycle (accept overnight/gap risk; consistent with a swing engine).
  - **(b)** Fund an intraday monitoring cadence for Core open positions (new operational scope).
- **Recommendation:** **(a) close-based on EOD** for v1 — it matches a swing engine's nature and adds no new cadence; the residual gap risk is disclosed and bounded by position sizing. Owner to accept the gap-risk trade-off explicitly. (Pairs with the ratified gap-through-fills-at-actual-price rule.)

### C-5 — Core hard-stop **value**
- **Decision required:** The numeric Core hard-stop distance (under the C-2 basis).
- **Why it matters / Impact:** Sets the per-trade max loss; directly governs drawdown and recovery.
- **Available options:** Any value — **strictly owner/Master-Spec** (`EXIT_PARAMETER_SOURCE_AUDIT`: none in-repo).
- **Recommendation:** **No value invented.** Transcribe from the owner-held Master Spec; if absent there, the owner sets it explicitly.

### C-6 — Core **win-rate posture** (gate reconciliation)
- **Decision required:** Given a trend exit likely yields a Core win rate **below 0.85** by design, does the **0.85 win-rate gate** stand for Core, or move?
- **Why it matters:** Trend-following is structurally low-WR / high-PF. Keeping 0.85 *and* a trend exit may make the gate unreachable for Core regardless of parameters.
- **Impact:** Determines whether the campaign can pass; risks baking in a failure before it runs (`EXIT_PHILOSOPHY_REVIEW` §2).
- **Available options:**
  - **(a)** Keep 0.85 WR (accept Core may rely on PF and a high Turbo WR to blend up).
  - **(b)** Set a Core-appropriate (lower) WR target, paired with a higher PF expectation.
  - **(c)** Evaluate the gate at the **portfolio** level only (not per-engine), letting Turbo's WR offset Core's.
- **Recommendation:** **Owner decision (strategic).** Note: this is a **governance-gate** value, not a trading rule — changeable without touching strategy. Flagged because it interacts directly with the ratified Core philosophy.

---

## B. Turbo (Hard stop + Break-even + Trailing + Session flat) — open decisions

### T-1 — Turbo hard-stop **basis**
- **Decision required:** Percentage-of-entry vs ATR-multiple vs other for the Turbo protective stop.
- **Why it matters:** Turbo **does** carry an `atr` fact (`facts.py:73`), so an ATR-based stop is *feasible* at entry; but ATR is a **scan-time** fact (per-cycle recomputation for open positions still needs the same data-path consideration as C-3 if the stop must adapt intraday).
- **Impact:** Determines how volatility-aware the Turbo floor is.
- **Available options:** (a) percentage (marks-only, deterministic); (b) ATR-multiple at entry (uses entry-time ATR, fixed for the trade — no per-cycle recompute); (c) ATR-multiple recomputed intraday (needs data path).
- **Recommendation:** **(a) or (b)** — both implementable without a new data path if ATR is captured **at entry** and held fixed. **Basis choice + value are owner/Master-Spec.** (No value invented.)

### T-2 — Turbo **break-even trigger**
- **Decision required:** What favorable move arms the break-even transition (basis + value)?
- **Why it matters:** Defines when downside is neutralized; central to Turbo's capital protection.
- **Impact:** Win rate and drawdown (earlier BE → fewer losers but more scratches; see T-3).
- **Available options:** percentage move / ATR move / structure (VWAP/ORB) — value owner-set.
- **Recommendation:** **No value invented;** basis should match T-1 for consistency. Owner/Master-Spec.

### T-3 — Turbo **break-even level** (scratch-as-loss artifact) *(critical measurement decision)*
- **Decision required:** Is the break-even level set at **exact entry** (PnL = 0) or **marginally profitable**?
- **Why it matters:** The frozen convention is **win = realized PnL > 0**, so a **PnL = 0 exit counts as a LOSS** (`D6`/`D14`). Exact-BE exits would therefore **depress the 0.85 win-rate** they were meant to protect.
- **Impact:** Direct, mechanical effect on the win-rate gate.
- **Available options:**
  - **(a)** BE at exact entry (simplest; scratches count as losses).
  - **(b)** BE set marginally profitable (a defended trade books as a small win — **not** a fixed profit *target*; the floor remains a stop, so `OWNER_PROFIT_POLICY` is preserved).
- **Recommendation:** **(b) marginally-profitable BE**, *if* the owner wants the 0.85 WR to be reachable — explicitly framed as a protective stop level, not a take-profit. **Value owner/Master-Spec.** Owner must rule, because (a) silently undercuts the WR gate.

### T-4 — Turbo trailing-stop **basis**
- **Decision required:** Percentage vs ATR vs structure for the Turbo trail.
- **Why it matters / Impact:** Governs how much intraday momentum is captured vs given back.
- **Available options:** (a) percentage (marks-only); (b) ATR-multiple (entry-fixed or intraday-recomputed → data path); (c) structure (VWAP/ORB — data path).
- **Recommendation:** **(a) percentage** for v1 (deterministic, no data path); value owner/Master-Spec. Structure-augmented trailing deferred unless the data path is funded.

### T-5 — Turbo hard-stop / BE / trail **values**
- **Decision required:** The numeric distances/triggers for T-1, T-2, T-4.
- **Available options / Recommendation:** **Strictly owner/Master-Spec — no values invented.**

### T-6 — Turbo **session-close flatten** specifics
- **Decision required:** (i) the **cutoff** (flatten *at* the last open frame vs *N minutes before* close), and (ii) the **exit reference price** at flatten.
- **Why it matters:** Defines "intraday" concretely and the realized PnL of session-flattened trades.
- **Impact:** Overnight-risk elimination vs closing-auction liquidity; and the booked PnL of every flattened Turbo trade.
- **Feasibility (grounded):** Session transition is **detectable today** via the frame's `market_open` flag (`frame.py:50`) — flatten when `market_open` flips True→False (or on the last open frame). So *detection* needs no new data; the **precise cutoff time** and the **close reference price** are the open parameters.
- **Available options:** (i) at-last-open-frame vs fixed pre-close cutoff; (ii) last valid mark of the session vs an official close price.
- **Recommendation:** **At the last open frame, using the last valid session mark** (consistent with the ratified gap-fills-at-actual-price and the paper supplied-mark convention) — deterministic and data-available. A fixed pre-close cutoff is an owner option if closing-auction liquidity is a concern. **Cutoff value owner/Master-Spec.**

---

## C. Cross-cutting & governance — open decisions

### X-1 — Long/Short symmetry **scope confirmation**
- **Decision required:** Confirm symmetry applies **identically to all Turbo exit parameters** (hard stop, BE trigger/level, trail, session flat), mirrored for shorts. (Core is long-only, so symmetry binds **Turbo only**.)
- **Why it matters:** "Symmetry" was ratified in principle; implementation needs to know it means *same values, reflected* — not short-specific values.
- **Impact:** Parameter count and short-side risk behavior.
- **Available options:** (a) full symmetry (same values mirrored); (b) short-specific values (asymmetric — doubles the parameter set).
- **Recommendation:** **(a) full symmetry** (consistent with the ratified direction); owner to confirm no short-specific overrides for v1.

### X-2 — Exit-state **recovery scope** (no-schema constraint)
- **Decision required:** Confirm the trailing-peak / BE-armed / structure state is **re-derived (not persisted)**, scoped to the **deterministic replay** campaign — or fund persistence for live.
- **Why it matters:** `EXIT_CLOSE_ARCHITECTURE` adds no schema; exit-state is re-derivable for replay but a **live** restart could rebuild a trail from a lower peak (R-2).
- **Impact:** Replay = safe; live = needs persistence (a future schema phase).
- **Available options:** (a) no-persist, replay-scoped (v1 campaign); (b) fund persisted exit-state (schema phase, enables live).
- **Recommendation:** **(a) no-persist for the v1 replay campaign**; defer (b) to a separately-gated live phase.

### X-3 — **R-multiple / risk-basis** (side-effect of introducing hard stops)
- **Decision required:** Now that hard stops create a real per-trade risk amount, **persist** it to enable the D14 R-multiple metric (currently non-computable, metric 12), or keep R-multiple **deferred**?
- **Why it matters:** Persisting a risk basis is a **schema change** (new field) — outside the no-schema constraint; but it would make a currently-dead validation metric real.
- **Impact:** Reporting richness vs scope/schema discipline.
- **Available options:** (a) keep R-multiple deferred (no schema change — default); (b) fund a schema phase to persist the risk basis.
- **Recommendation:** **(a) keep deferred** for v1 (preserves the no-schema constraint); revisit with the live persistence phase (X-2b) if wanted.

### X-4 — **OP-3 in-v1 exception** ruling *(governance)*
- **Decision required:** Formally record that the exit/close build is the **sanctioned in-v1 exception** to `OWNER_PROFIT_POLICY_REVIEW` OP-3 / §C (which froze "trail/take-profit" exit logic to V2_BACKLOG).
- **Why it matters:** Without this ruling, EX-1 contradicts a standing frozen-to-V2 governance item (`EXIT_PARAMETER_SOURCE_AUDIT` §3.4).
- **Impact:** Governance consistency; authorizes EX-1 cleanly.
- **Available options:** (a) record the exception (exits built in v1 under the new approvals); (b) re-freeze exits to V2 (halts the entire exit workstream).
- **Recommendation:** **(a) record the exception** — consistent with every approval since `EXIT_CLOSE_ARCHITECTURE`. Owner to ratify explicitly.

### X-5 — **Source of numeric values**
- **Decision required:** Confirm whether the **owner-held Master Specification** contains the exit values (C-5, T-5, T-2/T-3 triggers, T-6 cutoff, the basis selections) — and if not, that the owner will set them explicitly.
- **Why it matters:** Per `EXIT_PARAMETER_SOURCE_AUDIT`, **none exist in-repo and the Master Spec file is not in the repository.** EX-1 cannot proceed faithfully until values are supplied.
- **Impact:** Hard prerequisite for implementation; prevents strategy invention (freeze violation).
- **Available options:** (a) transcribe from Master Spec; (b) owner sets explicitly if Master Spec is silent.
- **Recommendation:** **(a) then (b).** No value will be invented under any circumstance.

---

## D. Decision checklist (what the owner must return)

| ID | Open decision | Type | Blocks EX-1? |
|---|---|---|---|
| **C-1** | Core structure/trend exit reference (which signal = thesis broken) | Strategy (reuse existing) | **Yes** |
| **C-2** | Core hard-stop basis (% / structure; ATR infeasible) | Strategy/feasibility | **Yes** |
| **C-3** | Fund Core structure-exit data path? | Scope/schema | **Yes** (determines C-1 feasibility) |
| **C-4** | Core hard stop: EOD-close-based vs intraday monitoring | Operational | **Yes** |
| **C-5** | Core hard-stop value | Master-Spec value | **Yes** |
| **C-6** | Core win-rate gate posture | Governance gate | Recommended before campaign |
| **T-1** | Turbo hard-stop basis | Strategy | **Yes** |
| **T-2** | Turbo break-even trigger | Master-Spec value | **Yes** |
| **T-3** | Turbo break-even level (scratch-as-loss) | Strategy + value | **Yes** |
| **T-4** | Turbo trailing-stop basis | Strategy | **Yes** |
| **T-5** | Turbo hard/BE/trail values | Master-Spec values | **Yes** |
| **T-6** | Turbo session-close cutoff + reference price | Strategy/feasibility | **Yes** |
| **X-1** | Long/Short symmetry scope (Turbo) | Confirmation | **Yes** |
| **X-2** | Exit-state recovery scope (no-persist, replay) | Scope | **Yes** |
| **X-3** | Persist risk basis for R-multiple? | Scope/schema | Optional (default: no) |
| **X-4** | OP-3 in-v1 exception ruling | Governance | **Yes** |
| **X-5** | Source of numeric values (Master Spec) | Process | **Yes** (prerequisite) |

---

## E. Stop gate

**STOP — decision matrix only. Awaiting owner decisions.**

No values invented, no implementation designed, no code. EX-1 cannot begin until the "Blocks EX-1? = Yes" rows are decided and the Master-Spec values (X-5) are supplied. EX-1…EX-5 and OR-2 remain paused. No broker / TradingView / IBKR / live trading.
