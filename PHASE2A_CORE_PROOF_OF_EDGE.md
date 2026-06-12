# PHASE2A_CORE_PROOF_OF_EDGE

**Type:** Minimal scope spec for a low-cost "Proof of Edge". **No code in this document. No strategy change. Strategy 1 & Strategy 2 frozen.**
**Single question to answer:** *Does Core's SELECTION have any real predictive edge on real daily data — yes or no?* This is the cheapest possible go/no-go gate before any further investment (data, FactsBuilder, F-B fix, Turbo, Strategy 2).

---

## 1. Why this, and why now (owner's reasoning, refined)

- Every result to date is on **synthetic deterministic fixtures**. Core's real-market edge is **unproven**.
- Building the full infrastructure (intraday data ~$10k–$50k+, full FactsBuilder, cost layer) **before** confirming Core has any edge risks months of wasted effort on a possibly-false premise.
- **Refinement — test at the signal level first.** Core's *exit* is known-broken (F-B). If we run Core end-to-end with its broken exit and it loses, we cannot tell *no-edge* from *exit-defect*. A **signal-level event study** (forward returns of Core entry signals) **isolates the selection edge from the exit**, and is the cheapest, cleanest test.

---

## 2. Scope

**IN scope:**
- **Core engine only** (Long-only, Bull-gated).
- **Daily data only** (no 1-minute / intraday).
- **~5 years** of history + ≥200-day warmup.
- **Real, survivorship-free daily data** (incl. delisted names).
- **Primary test:** signal-level forward-return event study.
- **Secondary test (optional):** full Core simulation as-built (frozen, incl. F-B exit) for context.

**OUT of scope (deferred until/unless Core passes):**
- Turbo, intraday/1-minute data, intraday FactsBuilder, expensive intraday feeds.
- Strategy 2, F-B fix, any strategy modification.
- Live broker, deployment.

---

## 3. Minimal data required (daily only)

| Data | Needed for | Note |
|---|---|---|
| Daily adjusted OHLCV (NASDAQ+NYSE) **incl. delisted** | SMA50/150/200, ADV, daily RVOL, 52-w high, base, RS, forward returns | survivorship-free is mandatory |
| Corporate actions (splits/dividends) | point-in-time adjustment | as-occurred |
| SPY daily | regime (SMA200), RS denominator | — |
| Earnings (date + BMO/AMC, surprise) | PEAD (`surprise_positive`, `days_since≤10`, `aligned`) | daily-computable; defer only if unavailable |
| Point-in-time sector map | sector-exposure context | if unavailable → run with sector gate relaxed + note caveat |
| Point-in-time universe/listing membership | survivorship-free selection | critical anti-bias |

**No intraday, no borrow, no minute bars.** This is the entire data footprint — **< 2 GB**, the cheap tier.

---

## 4. Core fact-parity specification (the #1 risk — must be pinned BEFORE trusting any result)

Each Core fact must be computed to **match D3's definition exactly**. The parity table to ratify:

| Fact | D3-expected definition (to reconcile) |
|---|---|
| regime | SPY close vs SPY SMA200, ±1% band → Bull/Bear/Sideways |
| `trend_stage2` | price > SMA50 > SMA150 > SMA200 **and** SMA200 rising |
| `rs_rating` | cross-sectional relative-strength rank over the point-in-time universe (define lookback + ranking method) |
| `rvol` | daily volume ÷ trailing average volume (define window) |
| `adv` | trailing average daily volume (define window) |
| `breakout.new_52w_high` | rolling 252-day high |
| `breakout.base_breakout` / `base_days` | consolidation-base detection, qualifies at ≥ 50 days (define base rule) |
| `earnings` (PEAD) | positive surprise, `days_since ≤ 10`, `aligned` (define alignment) |

A written parity spec + a reconciliation check (FactsBuilder output vs these definitions on sample cases) is **mandatory**; without it the study is invalid.

---

## 5. The tests & pass/fail

### Primary — signal-level forward-return event study (cheapest, cleanest)
- For every Core entry signal (point-in-time), measure **forward return** at +5/+10/+20 trading days, **net of costs** (commission + modest daily slippage), vs the benchmark/universe.
- **PASS (Core has selection edge):**
  1. Mean forward return **> 0** and **statistically significant** (t-stat > ~2, or bootstrapped CI excludes 0).
  2. **Monotonic by score band** — higher bands (UltraGolden) outperform lower (Watchlist) — confirming the score is informative.
  3. Holds **out-of-sample** and across **walk-forward** windows (not one period).
  4. Not driven by a single regime/sector (segment-checked).
- **FAIL:** no significant positive forward return, or no band monotonicity → **Core's selection premise is invalid.**

### Secondary (optional) — full Core simulation, frozen as-built
- Run Core end-to-end (incl. the F-B exit) for context only. Expected to underperform the signal-level result **because of F-B** — which itself is evidence that the problem (if Core's signal passes) is the exit, not the selection.

### Decision rule
- **Signal FAILS** → **STOP all Core work.** Do not fix F-B, do not build the full FactsBuilder, do not buy intraday data, do not develop Strategy 2. The core premise is wrong. *(This is the months-saving outcome.)*
- **Signal PASSES** → Core has real selection edge → proceed: fix F-B (exit), then full FactsBuilder, then Turbo, then full validation.

---

## 6. Build footprint (only after the data decision — §7)

When real daily data is available, the minimal build is small (Core-daily only):
- Core-daily **FactsBuilder** (the §4 facts) + parity reconciliation.
- A **daily historical provider** + a **forward-return/event-study evaluator** (and optionally the daily Core simulation reusing the frozen orchestrator behind the `MarketDataProvider` seam).
- A light cost model (commission + daily slippage; no borrow — Core is long-only).
- All **additive**, isolated from the frozen trading system and its PostgreSQL schema.

---

## 7. The one blocking dependency — real data

A Proof of Edge **requires real historical daily data**. This environment has **no market data and no data-procurement/network path**, and **synthetic/fabricated data would invalidate the entire test** (the exact bias we are escaping). Therefore I will **not** fabricate data, and the build cannot produce a verdict until real data is supplied.

**This is the single decision needed before any build:** how will the real, survivorship-free daily dataset be provided?

---

## 8. Stop gate

**STOP — scope spec only. No code, no strategy change; Strategy 1 & Strategy 2 frozen.** Awaiting the data-provisioning decision (§7) before any build. The objective remains: *determine whether Core has real selection edge — at the lowest possible cost — before any further investment.*
