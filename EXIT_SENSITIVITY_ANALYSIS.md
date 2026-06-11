# EXIT_SENSITIVITY_ANALYSIS

**Type:** Sensitivity analysis only. **No implementation. No code. No values recommended. No final values chosen.**
**Status:** Analysis for owner review. Ranks the six required exit values (`EXIT_VALUE_DECISION_MATRIX.md` V-1…V-6) by their influence on the probability of **passing the validation campaign**.
**Validation policy evaluated against:** **Win Rate ≥ 85% · Profit Factor ≥ 2.0 · Max Drawdown ≤ 10%** (joint — all three must hold).

---

## 0. Method & framing (read first)

- **This is structural/directional reasoning, not a backtest.** No campaign data exists yet (producing it is the campaign's purpose). The ranking reflects how each parameter *mechanically* moves each gate and how strongly it couples to the **binding** constraint.
- **The gates must hold jointly.** Pass probability is governed by the *hardest-to-satisfy* gate and by any parameter that creates a **trade-off between two gates** (a parameter that lifts one gate while sinking another is high-leverage on the joint outcome).
- **The hardest gate is Win Rate ≥ 85%.** Under a *winners-run* philosophy, PF ≥ 2.0 is comparatively *aided* by the design (winners run → large numerators), so PF is the **least likely binding** gate. DD ≤ 10% is a hard floor controlled mainly by the protective stops. **WR ≥ 85% is the most demanding and most fragile** — so parameters that drive WR, or that trade WR against PF, dominate the ranking.
- **Engine weighting matters.** Turbo is the **higher-frequency** engine (intraday, long+short) and therefore dominates the 200-trade count and the blended WR/PF/DD. Core is lower-frequency (EOD, long-only, ≤5 open) and its profit-side exit is the **boolean structure/trend break (no V-parameter)** — so Core's single value (V-1) bites only on **floor hits** (tail losses). This pushes the five Turbo values above the one Core value in aggregate leverage, with one tail-risk caveat noted under V-1.
- **No values are proposed.** "Too tight" / "too loose" describe *directional* consequences only.

---

## 1. Ranking — highest → lowest impact on validation success

### #1 — V-5 · Turbo trailing-stop distance *(highest impact)*
- **Why it matters:** It sets the **WR↔PF trade-off for the bulk of Turbo winners** — the single axis on which the two tension-bound gates (WR ≥ 85% and PF ≥ 2.0) are won or lost *together*. It also governs give-back, so it touches DD. No other parameter affects two binding gates with this breadth and magnitude.
- **Too tight:** locks gains early → many small wins → **WR up**, but winners are cut short → **PF down** (can fall below 2.0); give-back small → DD low. Risk: passes WR, **fails PF**.
- **Too loose:** lets winners run → larger winners → **PF up**, but more trades round-trip from profit back through the trail → **WR down** and **give-back DD up**. Risk: passes PF, **fails WR (and pressures DD)**.
- **Most-affected metric:** the **WR/PF balance** (both simultaneously) — the joint feasibility pivot.

### #2 — V-4 · Turbo break-even offset *(scratch-as-loss control)*
- **Why it matters:** It is the **cheapest, most direct lever on the binding WR gate.** Under the frozen *win = realized PnL > 0* convention, a defended trade that exits at exact entry counts as a **loss**; a small positive offset reclassifies that same trade as a **win** — moving the hardest gate with minimal effect on PF or DD.
- **Too tight (offset ≈ 0 / at entry):** defended-but-flat trades book as losses → **WR suppressed** precisely where it is hardest to earn; the break-even machinery protects capital yet *hurts* the WR metric.
- **Too loose (large offset):** the stop sits well above entry → tagged on minor pullbacks → ends some would-be runners early → slight **PF drag**, and fewer trades reach the full trail.
- **Most-affected metric:** **Win Rate** (near-mechanical), at low cost to PF/DD — high leverage *because* it targets the binding gate cheaply, though bounded to the defended-and-pulled-back subset.

### #3 — V-3 · Turbo break-even trigger
- **Why it matters:** It sizes the **population of trades that get defended at all** — i.e., how many trades become eligible for the V-4 reclassification and for downside neutralization. It is the gatekeeper of the WR-defense machine and a primary DD lever for Turbo.
- **Too tight (arm early):** more trades reach BE → more downside neutralized → **DD down**, but more trades end as scratches/small results (interacts with V-4) and momentum is capped before maturing → **PF drag**; WR effect depends on V-4.
- **Too loose (arm late):** few trades get defended → **DD exposure up** and winners-turned-losers reduce **WR**; the trades that *do* run stay intact → some **PF** benefit.
- **Most-affected metric:** **Win Rate** (population defended) with strong secondary effect on **Max Drawdown**.

### #4 — V-2 · Turbo hard-stop distance
- **Why it matters:** It is the **protective floor on the high-frequency engine** — the primary control on Turbo per-trade loss size, hence the dominant contributor to the **DD ≤ 10%** gate (many Turbo trades → cumulative loss control matters most here). Secondary WR effect via stop-out frequency.
- **Too tight:** frequent stop-outs → **WR down** and many small losses → **PF denominator up (PF down)**; but each loss is small → **DD low**. Risk: protects DD, **erodes WR/PF**.
- **Too loose:** fewer stop-outs → **WR up**, but each loss is large → **DD up (can breach 10%)** and **PF denominator up**. Risk: lifts WR, **fails DD**.
- **Most-affected metric:** **Max Drawdown** (with WR as the trade-off side).

### #5 — V-1 · Core hard-stop distance
- **Why it matters:** It is the **only** Core value and governs the **size of Core tail losses** (Core's profit exit is the boolean structure break, so V-1 acts only when the floor is hit). It controls Core's contribution to **DD** and to the **PF denominator** (large losers). Lower aggregate weight than the Turbo values because Core is lower-frequency — **but** with one sharp caveat below.
- **Too tight:** Core trades stopped before the trend resumes → **WR down** for Core and winners-run undermined → **PF down**; losses small → DD low.
- **Too loose:** Core rides losers further → **DD up** and **PF denominator up**. **Tail-risk caveat:** Core runs on an **EOD cadence**, so a loose stop combined with an overnight **gap-through** (ratified to fill at the actual price) can produce a **single large loss that alone threatens the 10% DD gate** — a low-frequency but high-severity path that elevates V-1's importance specifically for DD.
- **Most-affected metric:** **Max Drawdown** (via tail losses) and **PF** denominator; limited WR effect.

### #6 — V-6 · Turbo session-close cutoff *(lowest impact)*
- **Why it matters:** A **timing backstop** that force-flattens only the **subset of Turbo trades still open at session end**; the flatten can realize a win or a loss depending on the mark. It is a risk-containment guarantee (no overnight Turbo carry), not a primary driver of the metric distribution.
- **Too tight (exit well before close):** avoids late-session reversals → modest **DD/WR** protection, but cuts late-session runners → mild **PF drag**.
- **Too loose (flatten at/just before close):** captures full-session moves → mild **PF** benefit, but exposes positions to closing-auction volatility → mild **WR/DD** risk.
- **Most-affected metric:** **Max Drawdown** (late-reversal tail), minor WR — smallest overall footprint because it touches only end-of-session open trades.

---

## 2. Ranked summary

| Rank | Parameter | Engine | Primary gate moved | Nature of leverage |
|---|---|---|---|---|
| **1** | **V-5** Turbo trailing distance | Turbo | **WR ⇄ PF** (both) | Broadest; sits on the WR/PF tension axis — the joint-feasibility pivot |
| **2** | **V-4** Turbo break-even offset | Turbo | **WR** | Cheap, near-mechanical lever on the binding gate (scratch-as-loss) |
| **3** | **V-3** Turbo break-even trigger | Turbo | **WR** (+ DD) | Sizes the defended population; gates V-4 |
| **4** | **V-2** Turbo hard-stop distance | Turbo | **MaxDD** (+ WR) | Floor on the high-frequency engine; primary DD control |
| **5** | **V-1** Core hard-stop distance | Core | **MaxDD** (+ PF) | Core tail-loss size; lower frequency, but EOD-gap tail risk |
| **6** | **V-6** Turbo session-close cutoff | Turbo | **MaxDD** (minor) | Backstop on end-of-session open trades only |

**Two structural reads for the owner:**
- **The top three are all Win-Rate machinery (V-5, V-4, V-3).** Because WR ≥ 85% is the hardest, most fragile gate, the parameters that drive WR — and especially V-5, which trades WR against PF — carry the most influence over whether the campaign can pass *at all*.
- **The drawdown gate is held mainly by V-2 and V-1 (the hard stops),** with V-6 as a tail backstop. These are lower on the *pass-probability* ranking only because DD ≤ 10% is more straightforwardly controllable than WR ≥ 85% — provided the stops are not set so loose that a single tail loss (notably a Core EOD gap, V-1) breaches the floor.

---

## 3. Stop gate

**STOP — sensitivity analysis only. Awaiting owner direction.**

No values recommended, no values chosen, no implementation, no code. This ranking is structural/directional pending real campaign data. EX-1…EX-5 and OR-2 remain paused. No broker / TradingView / IBKR / live trading.
