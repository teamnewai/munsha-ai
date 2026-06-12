# EXIT_PHILOSOPHY_REVIEW

**Type:** Strategy-level review. **No implementation. No code. No parameter values invented. No implementation design.**
**Status:** **COMPLETE — awaiting owner decision.** Requested before EX-1 is authorized.
**Objective:** Determine the most appropriate **exit philosophy** for THUL-NURAYN, grounded in the approved strategy, `OWNER_PROFIT_POLICY`, the Core Swing and Turbo Intraday engines, and the validation objectives — comparing approaches A/B/C/D and recommending a philosophy (not numbers) per engine.

**Discipline:** This document recommends *philosophies and reuse of existing definitions*. It invents **no** percentages, distances, multiples, or triggers — those remain owner/Master-Spec decisions (per `EXIT_PARAMETER_SOURCE_AUDIT.md`, none currently exist in-repo).

---

## 0. Grounding facts that constrain the choice (source-verified)

**Engines (`PROJECT_STATE_CHECKPOINT_B6.md` §6; `src/selection/facts.py`):**
- **Core Swing:** Long-only, **Bull-gated** (trades only when SPY > SMA200 × 1.01). Thesis facts already defined: `trend_stage2` = *"price > 50 > 150 > 200, SMA200 rising"* (`facts.py:60`), `BreakoutFacts` (52-week high / base breakout ≥ 50d), RS rating, RVOL, PEAD. **Cadence: EOD/daily** (`P-ORCH` OD-PORCH-4).
- **Turbo Intraday:** Long (Bull) / Short (Bear). Thesis facts already defined: `above_vwap`, `orb_confirmed`, `momentum_ok` (`facts.py:76-79`), RVOL ≥ 3.0, gap ≥ 4%, **ATR ≥ $0.50** (an *entry-selection* gate, not an exit), ADV, premarket volume. **Cadence: intraday/minute** (`P-ORCH` OD-PORCH-4).

**Owner Profit Policy (`OWNER_PROFIT_POLICY.md`):** trailing-stop primary · **no fixed profit target may force an exit** · **winners run** while exit conditions hold · profit % reporting only · **full closes only** (partial deferred to V2, Rule 7).

**Validation gate — the implemented campaign defaults (`src/app/validation/gate.py:24-27`):** `min_trades=200`, **`min_win_rate=0.85`**, **`min_profit_factor=2.0`**, **`max_drawdown_limit=−0.10`**. (Governance config, owner-settable; these are the *current* targets the exit philosophy will be judged against.)

**Win/loss convention (frozen, `D6`/`D14`):** a trade is a **win only if realized PnL > 0**; **PnL = 0 (a scratch/break-even exit) counts as a loss.** This convention is frozen and materially affects philosophies that produce break-even exits.

**Data-availability constraint (verified, `marketdata/frame.py:54`):** for an **open** position, the only guaranteed per-cycle input is its **price mark**. Structural facts (trend stage, VWAP, ORB, ATR) are computed **at scan time for candidates**, not refreshed per-cycle for held positions. ⇒ Any **structure/trend-based exit (C)** requires a **new per-cycle data path** to recompute those facts for open positions — a data-architecture/schema phase, not just an exit phase.

**Cadence constraint:** Core evaluates on an **EOD/daily** cycle. A Core "hard stop" is therefore actionable only **at the daily close**, not intraday — i.e., Core stops are effectively close-/daily-based and carry **overnight/gap** exposure unless Core's evaluation cadence is changed. Turbo's minute cadence *can* react intraday and *can* flatten at session end.

**No risk basis today (`D14` metric 12; V2-001):** v1 persists **no stop-loss/risk amount**, so the R-multiple metric is currently non-computable. Introducing a protective hard stop would, as a side effect, create a real per-trade risk basis (a benefit for reporting), but it is a new strategy element requiring owner approval.

---

## 1. Approach comparison

Legend for impact: ▲ favorable · ▼ adverse · ◆ depends on parameters/owner choice.

### A) Fixed hard stop + trailing stop only
| Dimension | Assessment |
|---|---|
| **Core Swing compatibility** | ◆ Workable as a daily/close-based stop + daily trail (chandelier-style). But EOD cadence ⇒ no intraday stop ⇒ overnight gap risk; a fixed % trail is not trend-aware, so it can cut a still-valid trend or give back too much. |
| **Turbo Intraday compatibility** | ▲ Strong canonical fit (intraday stop + trail). **Gap:** A alone does not flatten at session end — a Turbo position could carry overnight, contradicting "intraday." Needs a session-close addition. |
| **Win rate** | ◆ Moderate. Every adverse excursion to a fixed stop is a full loss; a tight stop lowers WR, a wide stop raises it but worsens losses. Reaching **0.85** with a pure fixed stop is demanding. |
| **Profit factor** | ▲/◆ Capped loss size helps the denominator; trailing lets winners run *somewhat*. Decent PF, but a non-adaptive trail limits the largest winners. |
| **Drawdown** | ▲ **Strongest control.** A bounded per-trade loss is the cleanest way to protect the **≤ −10%** gate. |
| **Recovery** | ▲ Bounded losses → faster recovery. |
| **Winners-run** | ◆ Partial. Trailing honors it, but a fixed distance is not adaptive — over-trims in volatile names, over-gives in quiet ones. |
| **Complexity** | ▲ **Lowest.** Two parameters/engine; % basis computable from marks alone (no new data path); fully deterministic. |
| **Operational risk** | ▲ **Lowest.** Easy to audit/recover. Residual: Core EOD gap-through; parameter mis-set. |

### B) Hard stop + break-even transition + trailing stop
| Dimension | Assessment |
|---|---|
| **Core Swing compatibility** | ◆ Daily BE transition after a favorable close reduces winners→losers; reasonable on EOD basis (same gap caveat as A). |
| **Turbo Intraday compatibility** | ▲ **Excellent** intraday fit (BE once the trade works is standard for ORB/VWAP scalps). Needs session-close flatten. |
| **Win rate** | ◆ **Double-edged — critical nuance.** BE prevents winners turning into losers (▲), **but a break-even exit is PnL = 0, which the frozen convention counts as a LOSS (▼).** B can therefore *depress* the measured 0.85 WR even while protecting capital. Unless the BE level is set slightly profitable (an owner parameter), B can hurt the very metric it appears to help. |
| **Profit factor** | ▲ Removes/loss-shrinks reversing trades → fewer and smaller losses → improves PF. |
| **Drawdown** | ▲ **Best-in-class** with the hard stop: BE caps give-back from reversals. |
| **Recovery** | ▲ Excellent. |
| **Winners-run** | ▲ Compatible (trail after BE). |
| **Complexity** | ◆ Medium. Adds a BE trigger + an "armed" flag; both re-derivable from entry + mark history (no schema change). Deterministic. |
| **Operational risk** | ◆ Medium. The **BE-as-loss measurement artifact** is the notable trap; otherwise manageable. |

### C) Market-structure / trend-based exits with protective stop
| Dimension | Assessment |
|---|---|
| **Core Swing compatibility** | ▲ **Philosophically the best fit.** Core is a trend/breakout engine; the natural exit is "thesis broken" — e.g., `trend_stage2` no longer holds, close below a structure MA, or Bull regime flips. Maximally honors "winners run" → biggest winners. EOD cadence aligns (trend judged on daily close). |
| **Turbo Intraday compatibility** | ▲ Good — the intraday thesis-break exits (lost VWAP / ORB failure / momentum gone) reuse facts that already exist. |
| **Win rate** | ▼ **Lowest, and in direct tension with the 0.85 gate.** Trend/structure exits give back open profit before confirming the break; many trades end as give-backs or small round-trip losses. Trend-following is classically **low win rate / high payoff** — structurally hard to reconcile with **0.85**. |
| **Profit factor** | ▲ **Highest** — captures full moves; large winners dominate. Best path to **PF ≥ 2.0**. |
| **Drawdown** | ◆ Moderate–adverse. Protective stop bounds catastrophe, but giving back open profit widens equity swings → more pressure on the **≤ −10%** gate. |
| **Recovery** | ◆ Moderate (bigger swings). |
| **Winners-run** | ▲ **Best alignment** with `OWNER_PROFIT_POLICY` — this *is* "let winners run until the thesis breaks." |
| **Complexity** | ▼ **Highest.** Requires a **new per-cycle data path** to recompute structural facts for open positions (schema/data phase), per-engine "structure break" definitions, and more recovery state. |
| **Operational risk** | ▼ **Highest.** Data-path dependency, harder determinism, more definitions/state, structural-state recovery under the no-persist constraint. |

### D) Hybrid (protective stop floor + engine-appropriate profit mechanism)
| Dimension | Assessment |
|---|---|
| **Core Swing compatibility** | ▲ Protective hard stop (DD floor) **plus** a Core-appropriate profit mechanism (trend/structure exit, or an adaptive trail if the data path isn't funded). |
| **Turbo Intraday compatibility** | ▲ Protective hard stop **plus** BE + trail **plus** session-close flatten — the natural intraday stack. |
| **Win rate** | ◆ **Most tunable.** Turbo (BE/tight trail + session flat) can target high WR; Core (trend exit) accepts lower WR but contributes the big winners. The blended WR is a function of engine mix and parameters. |
| **Profit factor** | ▲ Core's trend exits supply PF; the hard-stop floor limits losses. Best chance at **PF ≥ 2.0 *and*** a respectable WR **simultaneously** — which the demanding 0.85 + 2.0 combination effectively requires. |
| **Drawdown** | ▲ Protective floor on **every** trade bounds DD; Core give-back is the residual risk to manage. |
| **Recovery** | ▲ Bounded by the floor. |
| **Winners-run** | ▲ Honored where it matters most (Core trends), while Turbo stays disciplined. |
| **Complexity** | ▼ High (two mechanisms + shared floor); inherits C's data-path need **only if** Core uses structure exits. |
| **Operational risk** | ◆ Moderate–High; concentrated in the Core structure-exit data path (avoidable if Core uses an adaptive trail instead). |

---

## 2. The central strategic tension (the owner must resolve)

The implemented gate asks for **win rate ≥ 0.85 AND profit factor ≥ 2.0 AND max drawdown ≤ 10%**, *while* `OWNER_PROFIT_POLICY` mandates **"let winners run."** These pull in opposite directions:

- **High win rate** is produced by **taking gains / tight management** (favors A/B) — but that **cuts winners** (against the policy) and **caps PF**.
- **High profit factor + winners-run** is produced by **letting trends extend** (favors C) — but that **lowers win rate** and **widens drawdown**.

No single philosophy maximizes all four. **The hybrid (D) is the only structure that can pursue both targets at once** — by letting *Turbo* defend win rate (disciplined, high-frequency, session-flat) and *Core* defend profit factor (trend-following, winners-run), with a hard-stop floor protecting drawdown everywhere. This is the core argument for D.

> **This review does not lower the gate.** Whether 0.85 WR is the right bar *given* a winners-run policy is itself an **owner decision** — the alternative is to accept a lower WR target in exchange for the higher PF that a true winners-run exit produces.

A second, governance tension (flagged in `EXIT_PARAMETER_SOURCE_AUDIT.md` §3.4) also requires an owner ruling: `OWNER_PROFIT_POLICY_REVIEW` OP-3 froze "trail by Y / take profit at X" exit logic to V2_BACKLOG; the approved `EXIT_CLOSE_ARCHITECTURE` builds exits in v1. The exit work proceeds only as the sanctioned in-v1 exception to OP-3.

---

## 3. Recommendations (philosophy only — no values)

### 3.1 Recommended philosophy for **Core Swing**
**Approach C in spirit, delivered pragmatically:** a **protective hard stop (downside floor) + a trend/structure-based profit exit that reuses Core's existing thesis definitions** (`trend_stage2` and/or the Bull regime gate / breakout facts). Rationale: Core is a Bull-gated trend/breakout swing engine; its faithful exit is "stay while the trend thesis holds, leave when it breaks," which is exactly "winners run" and the path to **PF ≥ 2.0**.

**Two owner-gated caveats that make this honest, not absolute:**
1. **Feasibility:** a true structure exit needs a **per-cycle data path** for open-position trend facts (a data/schema phase). If the owner does **not** fund that, Core falls back to an **adaptive (volatility- or %-based) trailing stop + protective hard stop (A/B)** computable from marks alone — at the cost of some winners-run fidelity.
2. **Win-rate reality:** a trend exit will likely produce a **win rate below 0.85** by design. The owner must decide whether to (a) accept a lower Core WR target in exchange for higher PF, or (b) prioritize the 0.85 gate and accept a more managed (winner-cutting) Core exit. **This is a genuine fork only the owner can choose.**

### 3.2 Recommended philosophy for **Turbo Intraday**
**Approach B + mandatory session-close flatten:** **protective hard stop → break-even transition → trailing stop, with a forced flat at session end.** Rationale: Turbo is an intraday momentum/ORB/VWAP engine; bounded intraday risk, BE to neutralize downside once it works, a trail to ride momentum, and no overnight carry (it is "intraday"). Turbo's higher trade frequency also helps reach the **200-trade** count.

**Owner-gated caveat:** the **break-even-as-loss** measurement artifact (§0, §1B). If the 0.85 WR gate is to be respected, the owner should decide whether the BE level is set marginally profitable (a parameter) so a defended trade is not booked as a loss — **without** introducing a fixed profit *target* (the floor stays a stop, not a take-profit; policy preserved). Structure-style intraday exits (VWAP loss / ORB fail) may *augment* B by reusing existing facts, subject to the same per-cycle data-path caveat as Core.

### 3.3 Should Core and Turbo share the same exit methodology?
**No.** They differ in timeframe (days vs minutes), evaluation cadence (EOD vs minute), direction profile (long-only vs long/short), and risk character (overnight trend vs intraday momentum). They **should share the same governing *principles*** — (i) a protective stop floor on every trade, (ii) winners-run via a trailing/structure mechanism, (iii) full closes only, (iv) no fixed profit target — but use **different mechanisms**. Forcing one methodology on both would mis-fit at least one engine and jeopardize the gate. (This makes the overall program a **Hybrid, D**, by construction: shared principles, per-engine mechanisms.)

### 3.4 Which parameters become **owner decisions** (values from the Master Spec — not invented here)
- The **stop basis** per engine (percentage vs volatility/ATR vs structure).
- **Core:** protective-stop distance/basis; the trend-exit **reference** choice (e.g., which structure/MA or regime condition) and any tolerance; whether to fund the structure-exit data path.
- **Turbo:** hard-stop distance; **break-even trigger** and BE level (scratch vs marginally-profitable); trail distance/basis; **session-close cutoff** time.
- **Strategic:** resolution of the **0.85-WR vs winners-run** tension (§2); whether the campaign WR/PF/DD gate values stand or move; the OP-3 in-v1-exception ruling.

### 3.5 Which parameters can be **derived from existing strategy logic** (reuse, not invent)
- **Core trend/structure reference:** reuse the **existing `trend_stage2` definition** (price > 50 > 150 > 200, SMA200 rising) and the **Bull regime gate** (SPY > SMA200 × 1.01) — "thesis intact" is already defined; the exit can be "thesis no longer holds" with **no new definition**.
- **Core breakout reference:** reuse existing `BreakoutFacts` (52-week high / base breakout).
- **Turbo structural references:** reuse existing `above_vwap`, `orb_confirmed`, `momentum_ok` — "lost VWAP / ORB failed / momentum gone" are already-defined facts.
- **Turbo volatility basis:** the **ATR fact already exists** (used for the $0.50 selection gate); if an ATR-based stop is chosen, the *basis* is reused (the *multiple* remains an owner value), subject to the per-cycle data-path question.
- **Not derivable (strictly owner/Master-Spec):** every numeric **distance, multiple, trigger, and cutoff**, and the **basis selection** itself.

### 3.6 Risks of choosing the **wrong** exit philosophy
1. **Over-management (too tight):** cuts winners → violates `OWNER_PROFIT_POLICY` → caps PF below 2.0; may *not* even lift WR if trades are stopped before the move. A self-inflicted PF failure.
2. **Under-management (too loose / pure trend):** gives back open profit → **breaches the −10% drawdown gate** and lengthens recovery; can fail the campaign on DD even with great winners.
3. **WR/PF objective conflict baked in:** committing to a single philosophy optimized for one metric can make the *other* gate mathematically unreachable — failing validation **before the campaign even runs**.
4. **Break-even/scratch artifact:** BE exits (PnL = 0) counted as losses can **depress the 0.85 WR** the philosophy was meant to protect.
5. **Data-path mismatch:** choosing structure exits (C/Core-D) without funding the per-cycle data path → either a forced schema phase or **silent degradation / non-determinism** (the replay campaign would not reproduce).
6. **Cadence mismatch:** a Core "intraday hard stop" is not actionable on the EOD cycle → uncontrolled **overnight gap** losses; Turbo without a session flat carries overnight risk it was never designed for.
7. **Recovery/state risk:** more stateful philosophies (armed-BE, structural state) increase restart-recovery complexity under the **no-persist** constraint.
8. **Strategy drift / freeze violation:** adopting exit values **not** in the Master Spec is an unauthorized strategy change — the precise risk this review and the source audit exist to prevent.

---

## 4. Summary

- **Core:** protective hard stop + **trend/structure exit reusing existing Core thesis definitions** (C-in-spirit), with two explicit owner forks — *fund the data path?* and *accept sub-0.85 WR for higher PF?*
- **Turbo:** **hard stop → break-even → trailing + mandatory session flatten** (B+flat), with the BE-level owner decision to avoid the scratch-as-loss artifact.
- **Shared methodology? No** — shared *principles*, per-engine *mechanisms* ⇒ the program is a **Hybrid (D)** by construction.
- The decisive, owner-only choices are the **0.85-WR vs winners-run** reconciliation, the **Core data-path funding**, the **per-engine numeric parameters** (from the Master Spec), and the **OP-3 in-v1 exception** ruling.

No values invented; no implementation designed; no code written.

---

## 5. Stop gate

**STOP — review only. Awaiting owner decision.**

EX-1…EX-5 and OR-2 remain paused. The next inputs required are: (1) the per-engine exit-philosophy ratification above, (2) resolution of the WR-vs-winners-run tension and the campaign gate values, (3) the owner-held Master-Spec parameter values, and (4) the OP-3 in-v1-exception ruling. No broker / TradingView / IBKR / live trading.
