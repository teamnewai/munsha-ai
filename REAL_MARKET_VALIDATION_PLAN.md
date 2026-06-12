# REAL_MARKET_VALIDATION_PLAN

**Purpose:** Define exactly how to determine whether **Strategy 1 (baseline THUL-NURAYN) actually works on real historical market data** — *before* any further improvement effort. **Methodology only. No code. No implementation. No strategy changes.**
**Why this matters:** every result so far (incl. +15.43% / PF 1.75) came from **deterministic synthetic fixtures**. Strategy 1 has **never** been run on real market data. This plan specifies the data, controls, and pass/fail bar required to answer "does it work in reality?"

---

## 0. What Strategy 1 actually consumes (the validation must reproduce these from real data)

Strategy 1's signals are computed from these facts (today supplied by fixtures; a real test must compute them point-in-time):

- **Regime (SPY):** SPY price vs its 200-day SMA, ±1% band → Bull / Bear / Sideways.
- **Core (EOD swing, Long-only, Bull-gated):** RS rating (relative strength), RVOL, ADV, `trend_stage2` (price > SMA50 > SMA150 > SMA200, SMA200 rising), breakout (new 52-week high **or** base-breakout ≥ 50 days), PEAD (positive earnings surprise within ≤ 10 days).
- **Turbo (intraday, Long Bull / Short Bear):** RVOL ≥ 3.0, gap ≥ 4%, ATR ≥ $0.50, ADV ≥ 500k, pre-market volume ≥ 100k, VWAP position, opening-range-breakout (ORB) confirmation, momentum.
- **Risk/exit:** max 5 open, max 5 trades/day, daily DD −3%, weekly DD −6%, consecutive-loss 3, sector ≤ 25%, capital 70/30 Core/Turbo; hard stop / break-even / trailing / session-flatten (Turbo); **Core has no active profit exit — F-B**.

> **Prerequisite (named, not built here):** a **point-in-time FactsBuilder + backtest harness** that computes the facts above from raw market data with no look-ahead. Strategy 1 cannot consume real data without it. Building it is a separate, gated engineering phase; this plan defines its requirements.

---

## 1. How to validate Strategy 1 on real historical data (approach)

1. **Acquire point-in-time datasets** (§2) covering a multi-regime span (§4), **including delisted/halted symbols** (§7).
2. **Build the point-in-time FactsBuilder** (prerequisite) that reproduces every §0 fact using only data available at each decision timestamp (§8).
3. **Replay** the real data through the **existing, unmodified** Strategy 1 pipeline via the `MarketDataProvider` seam (the same seam the fixture provider uses) — Core on an EOD cadence, Turbo on a 1-minute cadence.
4. **Model costs** (commission, slippage, borrow) on every fill (§9).
5. **Evaluate** on a strict **in-sample / out-of-sample** split (§5) and **walk-forward** windows (§6), per-engine (Core, Turbo) and combined.
6. **Score** against the real-market pass/fail bar (§10), with cost-stress and regime-stability robustness checks.

Validation is **observational**: Strategy 1's spec-fixed thresholds are *not* re-fitted. OOS/walk-forward exist to confirm the **fixed** parameters generalize across unseen periods and regimes.

---

## 2. Exact datasets required

| # | Dataset | Granularity | Used for | Notes |
|---|---|---|---|---|
| D-1 | **Daily OHLCV**, split/dividend-adjusted, NASDAQ + NYSE | daily | SMA50/150/200, 52-week high, base detection, ADV, RS rating, Core regime warmup | must include **delisted** tickers (§7) |
| D-2 | **Intraday 1-minute OHLCV incl. pre-market** | 1-min | VWAP, ORB, intraday ATR, gap, pre-market volume, momentum (Turbo) | pre/post-market sessions required |
| D-3 | **Corporate actions** (splits, dividends, symbol changes) | event | correct point-in-time adjustment; avoid adjustment look-ahead | as-occurred timestamps |
| D-4 | **Earnings calendar + surprise** (EPS actual vs estimate, **announcement timestamp + BMO/AMC flag**) | event | PEAD (≤10-day window) | as-first-reported; no restatements |
| D-5 | **Benchmark SPY** daily (and intraday if Turbo uses it) | daily/1-min | regime (SPY vs SMA200), RS denominator | same adjustment basis |
| D-6 | **Point-in-time sector/industry classification** | as-of | sector-exposure gate (≤25%), sector breakdown | historical, not today's mapping |
| D-7 | **Point-in-time index/universe membership** incl. delistings, halts, bankruptcies | as-of | survivorship-free universe (§7) | the single most important anti-bias dataset |
| D-8 | **Short borrow / locate availability + fees** | daily | feasibility & cost of Turbo Shorts | if unavailable, mark shorts "borrow-unverified" and report separately |
| D-9 | **Exchange calendar** (holidays, half-days, session times) | as-of | correct session/EOD/flatten timing | NY session |

**Source quality:** institutional-grade, point-in-time (e.g., survivorship-bias-free daily+intraday with corporate actions and a historical earnings/estimates feed). Vendor names are an owner procurement decision; the **requirement** is point-in-time + delisted coverage + intraday + earnings timestamps.

---

## 3. Minimum validation period

- **Warmup:** ≥ **200 trading days** before the first signal (SMA200 / 52-week base) — excluded from results.
- **Test span (after warmup):** ≥ **5 calendar years** of usable history, and long enough to produce **≥ 200 closed trades per engine** (Core and Turbo separately) so per-engine statistics are meaningful.
- **Rationale:** Core is an EOD swing engine with low trade frequency and a long warmup; reaching statistical significance and multi-regime coverage requires years, not months.
- **Recommended concrete window:** a span that includes the 2020 crash + recovery, the 2022 bear, and 2023–2024 bull/sideways — i.e., roughly **2018→present** (≥ 6–7 years) to guarantee all three regimes with margin.

---

## 4. Bull / Bear / Sideways coverage requirements

Regime is defined by the **system's own rule** (SPY vs SMA200 ±1%). The test window must contain **all three** with enough activity to evaluate each:

| Regime | Minimum coverage | Minimum trades (combined engines) |
|---|---|---|
| **Bull** | ≥ 250 trading days | ≥ 50 closed trades |
| **Bear** | ≥ 120 trading days | ≥ 30 closed trades |
| **Sideways** | ≥ 120 trading days | ≥ 20 closed trades (mostly Core "no-trade" — verify the gate behaves) |

- Report performance **segmented by regime** (return, PF, WR, max DD per regime).
- **Fail condition:** results are profitable *only* in one regime (e.g., only Bull), or a single regime contributes the entire net return. Real robustness requires no single regime to dominate.

---

## 5. Out-of-sample (OOS) testing requirements

- **Chronological split:** earliest **~60–70%** = in-sample (IS) inspection window; latest **~30–40%** = **OOS holdout**, **never inspected** until the final evaluation.
- **One-shot OOS:** the OOS window is scored **once**. Any iteration/tuning after seeing OOS invalidates it (it becomes in-sample).
- Because Strategy 1's parameters are **spec-fixed (not fitted)**, OOS specifically tests whether those fixed thresholds **generalize** to unseen data rather than coincidentally fitting the fixture era.
- **Pass:** OOS metrics are **directionally consistent** with IS (no collapse) — see §10.

---

## 6. Walk-forward testing requirements

- **Rolling, non-overlapping forward windows** across the full span (e.g., 12-month forward windows stepped every 6–12 months; ≥ 5 windows).
- Since nothing is fitted, walk-forward here measures **temporal stability**: each forward window is an independent OOS slice.
- **Report per window:** return, PF, WR, max DD, #trades.
- **Pass:** the **majority of windows are profitable after costs**, no single window produces the entire net return, and performance does **not** monotonically decay over time (no regime/edge decay).
- **Fail:** profitability concentrated in 1–2 early windows with later windows flat/negative (edge decayed).

---

## 7. Survivorship-bias controls

- **Use a point-in-time, survivorship-bias-free universe (D-7)** that **includes delisted, halted, merged, and bankrupt symbols** with the prices they actually had.
- **Never** select the historical universe from *today's* listed names or current index constituents.
- Universe membership (ADV ≥ 500k, listing status) must be evaluated **as-of each decision date**, not retroactively.
- Delisted symbols must remain tradeable up to their delisting and be force-resolved at the delisting price (not silently dropped).
- **Verification:** report the count of delisted/dead tickers that generated signals; if zero, the universe is contaminated by survivorship bias → invalid.

---

## 8. Look-ahead-bias controls

- **Point-in-time everything:** at each decision timestamp, use **only** data published/available at or before that instant.
- **Signal→fill separation:** never fill on the same bar that generated the signal using that bar's own close. Fill on the **next available bar/open** (EOD signal → next session's open; intraday signal → next minute), at a realistic price.
- **Indicators from completed bars only:** SMA/RS/RVOL/ATR/VWAP/ORB computed from **closed** bars up to the decision time; no partial-future bars.
- **Corporate-action timing:** adjust prices using only actions known as-of the date; do **not** back-propagate a future split/dividend in a way that leaks the future ratio into past signals.
- **Earnings/PEAD:** use the **announcement timestamp** and BMO/AMC flag; the PEAD signal becomes valid only **after** the announcement is public (no trading on not-yet-released earnings). Use **as-first-reported** figures, not restated.
- **RS / rankings:** relative-strength and any cross-sectional ranking use only data up to the decision date.
- **Regime:** SPY SMA200 computed from data ending the prior session (no same-day-close peeking for next-open entries).
- **Verification:** a deliberate "shift-by-one-bar" sanity test — if performance collapses when entries are delayed one bar, the original had look-ahead.

---

## 9. Realistic slippage & commission assumptions

| Cost | Assumption (baseline) | Stress (robustness) |
|---|---|---|
| **Commission** | US-equity per-share (e.g., $0.005/share, min/max per broker) **or** $0 commission + regulatory fees (SEC/TAF), applied on **entry and exit** | n/a |
| **Spread / slippage — Core (liquid swing)** | half-spread + **~5–10 bps** | **2×** |
| **Slippage — Turbo (gappy/momentum, intraday)** | half-spread + **~10–25 bps** (wider; momentum entries pay up) | **2×** |
| **Gap-through stops** | fill at the **actual gapped price** (matches the system's gap-fill rule), not the stop level | — |
| **Session-flatten (Turbo)** | fill at the closing auction / last liquid print with slippage | — |
| **Short costs** | borrow/locate fee (D-8); hard-to-borrow surcharge; exclude/flag names with no locate | — |
| **Capacity** | cap order size at a small **% of that day's ADV** (e.g., ≤ 1–2%) so fills are realistic; reject/scale-down otherwise | tighter cap |

- Costs are applied **per fill** (entry + exit + any partials), including the closing order of every round-trip.
- **Robustness gate:** the strategy must remain profitable under the **2× slippage** stress (see §10). If a modest cost increase flips it negative, the edge is not real.

---

## 10. Pass / fail criteria before any production deployment

> **Important:** the existing D14 gate (≥200 trades, **85% WR**, **PF 2.0**, MaxDD ≤10%) was **governance config tuned to a synthetic fixture**. **85% win rate is not realistic for a real-market momentum/breakout strategy** (per the strategy study). The criteria below are a **proposed realistic real-market bar**; the owner should **ratify** the final thresholds. All metrics are measured **after costs (§9), on OOS (§5) and walk-forward (§6) data**.

**Primary (all must pass):**
1. **Net return after costs > 0** over the full OOS span **and** positive in ≥ 2 of 3 regimes (not negative-catastrophic in any).
2. **Profit Factor ≥ 1.3** after costs (owner may set higher; **1.3–1.5** is a defensible real-market floor — *not* the synthetic 2.0).
3. **Max Drawdown ≤ 20%** after costs (realistic ceiling; the synthetic 10% is likely too tight for real data — owner to ratify).
4. **Statistical significance:** ≥ 200 closed trades per engine; **positive expectancy with 95% confidence** (e.g., t-stat of mean trade PnL > ~2, or bootstrapped CI excludes 0).
5. **Recovery:** every drawdown trough recovers to a new high-water mark within a bounded number of trades/days (no permanently unrecovered drawdown at span end).

**Robustness (all must pass):**
6. **OOS consistency:** OOS Profit Factor ≥ ~70% of IS Profit Factor (no collapse out-of-sample).
7. **Walk-forward stability:** majority of forward windows profitable; no single window contributes > ~50% of net return; no monotonic decay.
8. **Regime breadth:** profitable (or at least non-destructive) across Bull/Bear/Sideways; not dependent on one regime.
9. **Cost stress:** still net-positive under **2× slippage**.
10. **Per-engine integrity:** Core and Turbo each evaluated separately — **a known risk:** given F-B (Core has no active profit exit), expect **Core to fail or underperform badly** on real data. The plan must report Core and Turbo independently so a failing Core does not hide behind Turbo.

**Bias gates (hard fail if violated):**
11. Universe includes delisted names that generated signals (§7) — else **invalid**.
12. Shift-by-one-bar sanity test does not materially change results (§8) — else **look-ahead present, invalid**.

**Deployment rule:** production (live broker via the still-gated D13/IBKR path) is permitted **only** if **all Primary + all Robustness + both Bias gates pass on untouched OOS data**, ratified by the owner. Any failure → **do not deploy**; return to the Strategy 1 improvement roadmap (notably F-B) or a redesign decision.

---

## 11. Expected outcome & decision linkage (honest framing)

- This plan will most likely reveal that **Turbo carries the strategy and Core (F-B) is a drag or outright failure** on real data — consistent with `STRATEGY1_IMPROVEMENT_ROADMAP.md` (D1/D2 = P1).
- If **Turbo passes** the real-market bar but Core fails → fix Core (roadmap P1) and re-validate; Strategy 1 has a real edge worth improving.
- If **neither engine passes** after costs/OOS → Strategy 1 does **not** have a real-market edge as built → a from-scratch redesign is justified (and improving it would be wasted effort — exactly the question you posed).
- Either way, **this validation answers "does Strategy 1 work in reality?" before any further improvement spend.**

---

**Deliverable: this document only. No code, no implementation, no strategy changes. The next decision point is whether to fund the point-in-time FactsBuilder + data acquisition (the prerequisite to executing this plan).**
