# STRATEGY_IMPROVEMENT_STUDY

**Type:** Source-based strategy improvement study (analysis only). **No implementation. No code change. No new architecture.**
**Premise (owner-stated):** the OR-2 fixture was *designed* to yield ~60% WR; the observed 60% is a fixture artifact, **not** a proven THUL-NURAYN limitation. This study analyzes the *implemented strategy logic* to find the highest-impact, honest improvement levers and the realistic achievable envelope.
**Grounding:** verified against `src/selection/*` (D3), `src/risk/*` (D4), `src/app/exit_decision.py` (EX-1), `src/app/orchestrator.py` (P-ORCH). Single deliverable.

---

## 1. What the implemented strategy actually does (source-verified)

**Entry selection (D3).** Each engine scanner (`scanners.py`) applies **hard eligibility gates** and *drops* failures (returns `None`): Core requires Long + Bull + ADV≥500k + RS≥80 + RVOL≥1.5 + a 52-week/base breakout; Turbo requires RVOL≥3.0 + gap≥4% + ATR≥$0.50 + ADV≥500k + premarket≥100k + VWAP side + ORB/momentum/catalyst. Survivors are **scored** (Core /100: Regime 20·RS 20·Breakout 20·RVOL 15·Trend 15·PEAD 10; Turbo /100: RVOL 25·VWAP 20·Gap+Catalyst 20·ORB 20·Momentum 15) and **classified** (UltraGolden=100 · Golden 95–99 · Strong 90–94 · Watchlist <90, `ranking.py:classify_score`).

**Two structural findings that dominate this study:**

- **F-A — Execution ignores the classification band.** `RankingEngine.rank` only *sorts*; it never drops Strong/Watchlist. The orchestrator builds `candidates = result.core + result.turbo` (`orchestrator.py:218`) and D4's eight gates (`risk/gates.py`) contain **no classification gate**. ⇒ **A barely-eligible "Watchlist" signal is traded with exactly the same priority as an "UltraGolden" one.** The score band — the strategy's own quality measure — is recorded but **never used as a trade filter.**
- **F-B — The Core profit exit is dormant.** Per the ratified C-1 (Trend-Stage break AND Regime flip) under C-3 (marks-computable), EX-1 is fed `trend_stage2=None`, so the Core structure exit can never confirm (`exit_decision.py`). Core has **no break-even and no trailing** (hard-stop-only by design). ⇒ **A Core position can only ever close at its hard stop — i.e., as a loss — or not at all.** Core, as wired, cannot book a winning trade.

These two facts — not the fixture — are the real ceilings on a live THUL-NURAYN campaign's win rate and profit factor.

---

## 2. Highest-impact improvement levers (with directional effects)

Directional notation: ▲ improves · ▼ worsens · �average neutral/depends. (No values proposed.)

### L1 — Activate the Core structure/trend profit exit (resolve F-B / fund the C-3 data path)
- **What:** supply per-cycle trend-stage/breakout facts for *open* Core positions so the approved structure exit (and a Core trail) can take profits, instead of leaving the hard stop as the only exit.
- **Effect:** **Win Rate ▲▲** (Core), **Profit Factor ▲▲** (captures trend winners — the winners-run engine), **Return ▲▲**, **Drawdown ▼ (mild)** (give-back before the structure confirms).
- **Why #1:** with F-B in place, the entire Core engine contributes *only losses*. This is the single largest correctable drag; it converts a profitless engine into the strategy's primary winners-run profit source. Cost: a data-path/schema phase.

### L2 — Gate execution on a minimum classification band (trade Golden/UltraGolden only)
- **What:** require `classification ≥ threshold` before a candidate reaches execution (close the F-A gap).
- **Effect:** **Win Rate ▲** (higher-confluence signals win more often), **Profit Factor ▲** (fewer marginal losers), **Return ◦** (fewer trades, higher average quality — net depends on volume), **Drawdown ▼** (fewer low-quality losers).
- **Why high:** it directly raises average signal quality using the strategy's *own* scoring, at low complexity. Trade-off: **fewer trades** — tightening the band reduces campaign volume and can threaten the ≥200-trade requirement, so band vs volume must be balanced. (Strategy/risk logic → governance-gated.)

### L3 — Set the break-even level marginally profitable (the V-4 "scratch-as-loss" fix)
- **What:** place the armed break-even stop slightly above entry (beyond round-trip cost), not exactly at entry.
- **Effect:** **Win Rate ▲ (mechanical)** — under the frozen `win = realized PnL > 0` convention, a flat exit (PnL=0) counts as a **loss**; a small positive offset reclassifies every defended scratch as a small **win**. **Profit Factor ▲ (mild)**, **Return ▲ (mild)**, **Drawdown ◦**.
- **Why high:** near-zero complexity (a parameter), and it lifts the *binding* metric (WR) with negligible cost. It is a stop level, not a profit target — winners-run is preserved.

### L4 — Earlier/again break-even arming (V-3) for Turbo
- **What:** arm break-even after a smaller favorable move.
- **Effect:** **Win Rate ▲**, **Drawdown ▼** (more trades protected to break-even), **Profit Factor ▼ (slight)** (arming too early can clip would-be runners), **Return ◦**.

### L5 — Widen the trailing distance (V-5) on confirmed winners
- **What:** let the trail breathe so winners extend.
- **Effect:** **Profit Factor ▲**, **Return ▲**, **Win Rate ▼ (slight)** (more give-back round-trips), **Drawdown ▲ (slight)**. This is the explicit WR↔PF lever (the winners-run dial).

### L6 — Volatility-aware (ATR) hard stops (V-1/V-2)
- **What:** size the protective stop to instrument volatility rather than a flat %.
- **Effect:** **Win Rate ▲** (fewer noise stop-outs on volatile names), **Profit Factor ▲**, **Drawdown ◦ (bounded by design)**. Cost: needs per-cycle ATR for open positions (Turbo has entry-ATR; Core needs the L1 data path).

### L7 — Partial profit-taking / scale-out (currently deferred — V2, OWNER_PROFIT_POLICY Rule 7)
- **What:** bank a partial at a first objective, let the remainder run.
- **Effect:** **Win Rate ▲▲**, **Profit Factor ◦/▲**, **Return ▲**, **Drawdown ▼**. This is the *rare* lever that raises WR **without** abandoning winners-run (the runner still runs). Cost: governance review + a new mechanism (explicitly gated today).

### L8 — Sector/exposure & regime-confidence selectivity (drawdown control)
- **What:** tighten sector caps / require stronger regime confirmation. (Sector + weekly-DD inputs are now actually enforced after F-8.)
- **Effect:** **Drawdown ▼**, **Win Rate ▲ (slight)**, **Return ◦**.

---

## 3. Realistic achievable ranges (this strategy class)

THUL-NURAYN is a **selective, regime-gated momentum/breakout strategy with bounded protective stops and a winners-run profit policy.** For that class, with L1–L4/L6 applied honestly:

- **Win Rate:** realistic operating band ≈ **50–70%**. With band-filtering (L2) + break-even protection (L3/L4) + an active Core structure exit (L1), the upper realistic reach is ~**65–70%**. Sustained WR above ~70% requires systematic early profit-taking that erodes winners-run.
- **Profit Factor:** realistic band ≈ **1.6–2.5**. Because winners run (large average win from trend/structure exits) while losses are hard-stop-bounded, **PF ≥ 2.0 is realistically achievable — but at ~55–65% WR, not at high WR.** PF and WR trade off: as WR is pushed up via early exits, the average win shrinks and PF falls toward (then below) the gross-loss line.

The natural, defensible operating point is therefore **~60–68% WR with PF ~2.0–2.4, positive return, single-digit drawdown** — *not* a high-WR profile.

---

## 4. Explicit assessment: 85% / 90% / 95% / 100% WR

The question is whether each WR is reachable **without destroying Profit Factor, Winners-Run behavior, or positive return.**

| Target WR | Implied win:loss count | Realistically achievable here? | Why |
|---|---|---|---|
| **85%** | ~5.7 : 1 | **No** | Reaching 85% requires taking profits very early and/or holding losers — both collapse the average-win/average-loss ratio, dragging **PF below 2 (often below 1)** and **violating winners-run**. Attainable only by abandoning the winners-run thesis (convert to high-frequency mean-reversion), which is a *different* strategy and still struggles to hold PF≥2. |
| **90%** | 9 : 1 | **No** | Needs near-elimination of losing closes ⇒ effectively removing the protective stop ⇒ **unbounded tail loss**, destroying drawdown control and PF. Incompatible with the approved risk/exit framework. |
| **95%** | 19 : 1 | **No** | Achievable on paper only by *never realizing losses* (holding losers indefinitely / no stop) — high WR but catastrophic tail risk, **PF < 1 / negative expectancy** on the rare large loss, and it breaches the risk gates. Not a viable strategy. |
| **100%** | ∞ : 1 | **No (impossible)** | In any real market a protective stop guarantees occasional losses; 100% is definitionally reachable only by never closing a loser — i.e., not a strategy (infinite hold → eventual blow-up). |

**Conclusion of §4:** none of 85/90/95/100% WR is honestly achievable for THUL-NURAYN **while preserving winners-run + PF≥2 + positive return.** High win rate and a winners-run/high-PF profile are structurally opposed. The improvement levers above can credibly move a *live* campaign to the **~60–70% WR / PF≥2 / positive-return / low-drawdown** envelope — a strong, honest result — but **not** to the 85%+ band.

**Implication for the campaign gate (for the owner, not a change made here):** the 85% WR criterion conflicts with the ratified winners-run + PF≥2 policy. Reconciling it — e.g., evaluating WR at the portfolio level, or rebalancing the gate toward PF/return/drawdown with a realistic WR floor (~60%) — is the governance decision that makes the policy internally consistent. (Flagged only; not decided here.)

---

## 5. Opportunities ranked by expected impact

| Rank | Lever | Primary gains | Secondary | Complexity / gate |
|---|---|---|---|---|
| **1** | **L1 Activate Core structure/trend exit (fix F-B)** | Return ▲▲, PF ▲▲, WR ▲▲ (Core) | DD ▼ mild | High — needs C-3 data path (schema/data phase) |
| **2** | **L2 Minimum-classification execution gate (fix F-A)** | WR ▲, PF ▲ | volume ▼ | Low code; **strategy/risk → governance-gated** |
| **3** | **L3 Break-even offset > 0 (scratch→win)** | WR ▲ (mechanical) | PF/Return ▲ mild | Trivial — a parameter value |
| **4** | **L7 Partial profit-taking** | WR ▲▲, Return ▲, DD ▼ | PF ◦/▲ | High — **V2, separate owner review (Rule 7)** |
| **5** | **L6 ATR-aware hard stops** | WR ▲, PF ▲ | DD bounded | Medium — needs per-cycle ATR (ties to L1) |
| **6** | **L4 Earlier break-even arming (Turbo)** | WR ▲, DD ▼ | PF ▼ slight | Low — a parameter value |
| **7** | **L5 Wider trailing on winners** | PF ▲, Return ▲ | WR ▼/DD ▲ slight | Low — a parameter value (the WR↔PF dial) |
| **8** | **L8 Sector/regime selectivity** | DD ▼ | WR ▲ slight | Low–Medium |

**Top of the list is structural, not parametric:** the two largest honest gains come from closing **F-B** (Core can currently only lose) and **F-A** (the strategy ignores its own quality score at execution). The parameter levers (L3–L7) refine the WR/PF balance but cannot substitute for fixing those two.

---

## 6. Stop

Study complete. No code changed, nothing implemented, no architecture added. The realistic, honest ceiling for THUL-NURAYN under its ratified policy is **~60–70% WR with PF≥2, positive return, low drawdown**; **85%+ WR is not achievable without destroying Profit Factor and winners-run.** Highest-leverage opportunities are ranked in §5, led by activating the Core profit exit (F-B) and gating execution on signal quality (F-A).
