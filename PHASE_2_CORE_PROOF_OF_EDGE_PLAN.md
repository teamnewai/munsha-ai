# PHASE_2_CORE_PROOF_OF_EDGE_PLAN

**Type:** Decision framework only. **No code. No build. No FactsBuilder. No infrastructure. No data purchase.** Strategy 1, Strategy 2, shared layers, and the trading schema are **frozen**.
**The one question this answers:** *Does Core have a real market edge worth funding?*
**Stance:** this is a **gate**, not an engineering project. It defines the methodology, the data, the metrics, the bias handling, and the exact decision tree — so that the eventual (separately-approved) minimal run gives a clean **GO / STOP** answer at the lowest possible cost.

---

## 1. Exact methodology — validating Core with daily data only

**Test type: a signal-level forward-return event study** (not a full strategy simulation).

Rationale: Core's *exit* is known-broken (F-B). A full simulation would confound "no edge" with "broken exit." A signal-level study measures whether **Core's selection has predictive power**, isolated from the exit. This is the cheapest and cleanest way to answer the question.

**Procedure (to be executed later, upon separate approval — described here, not built):**
1. **Warmup:** ≥ 200 trading days before the first evaluated signal (SMA200 / 52-week base).
2. **Per trading day**, compute Core facts **point-in-time** (only data with date ≤ that day): SPY regime, SMA50/150/200 + `trend_stage2`, `rs_rating`, `rvol`, `adv`, 52-week-high / base breakout, PEAD.
3. **Fact parity by reuse:** feed the computed `CoreCandidateInput` + `MarketFacts` into the **frozen** `SelectionEngine.run_core(...)` and `MarketRegimeEngine` — so eligibility, scoring, classification, and regime are the **actual D3 logic**, not a re-implementation. (Only the raw fact math is new; the strategy logic is reused unchanged.)
4. **Record each Core signal's forward return** at **+5, +10, +20 trading days**, measured as **excess return vs SPY** (to neutralize market drift), **net of light costs** (commission + a modest daily slippage).
5. **Segment** results by score band (UltraGolden/Golden/Strong/Watchlist), regime (Bull/Bear/Sideways), and sector.
6. **Split** chronologically into in-sample (IS) and a one-shot **out-of-sample (OOS)** holdout, and evaluate **walk-forward** (rolling non-overlapping windows).
7. **Compute the edge metrics** (§5) and apply the decision tree (§7).

No portfolio simulation, no exit logic, no F-B dependency — just "do Core's entry signals predict positive excess returns?"

---

## 2. Minimum free datasets required

The free (zero-cost) screen needs only:

| Data | Free source (examples) | Used for |
|---|---|---|
| Daily adjusted OHLCV (current-listed US names) | Yahoo (yfinance) / Stooq / Alpha Vantage | SMA, RS, RVOL, ADV, 52-w/base, **forward returns** |
| SPY daily | same | regime, excess-return benchmark |
| Splits/dividends (via adjusted close) | bundled in the adjusted feed | adjustment |
| Earnings dates + surprise *(optional in the free pass)* | Alpha Vantage / FMP free tier | PEAD — **or defer** (run Core without PEAD and note it) |

**Not used in the free pass:** delisted names, point-in-time universe membership, point-in-time sector — these are exactly what free data lacks (§3–§4). Footprint: trivial (< 1 GB).

---

## 3. Exact assumptions & limitations of free data

1. **Survivorship-biased:** free feeds carry mostly **current-listed** names; failed/delisted/merged companies are largely absent.
2. **Imperfect corporate-action adjustment:** free adjusted series can contain subtle errors or even back-adjustment look-ahead.
3. **Weak earnings/PEAD:** surprise data is spotty and **not as-first-reported / not point-in-time** → PEAD may be approximated or deferred.
4. **No point-in-time universe or sector:** the universe is approximated by *today's* listings; the sector-exposure context is relaxed.
5. **Coverage gaps / rate limits / ToS constraints.**

**Net effect:** free data establishes an **optimistic upper bound** on Core's edge. It is valid **only as a negative screen** — see §4 and §6.

---

## 4. How survivorship bias affects the result

- **Direction is known and one-way: it inflates measured edge.** Removing the companies that failed (bankruptcies, delistings, big losers) leaves a sample skewed toward winners → forward returns are **overstated**.
- **Magnitude:** survivorship bias in US-equity backtests is commonly estimated to inflate returns by **~1–4%/year** (larger for small-cap / high-volatility names — exactly Core's momentum/breakout candidates), so the inflation here could be at the higher end.
- **Therefore:**
  - A **FAILURE on free (biased) data is decisive** — if Core shows no edge *even when the bias is helping it*, it has no real edge → **STOP at $0**.
  - A **PASS on free data is necessary but NOT sufficient** — part (or all) of the apparent edge may be the bias. It must be **confirmed on survivorship-free (paid) data** before any funding.
  - The free-screen bar (§6) is therefore set with a **cushion**: the edge must be clearly larger than what survivorship inflation + costs could explain, so a real (smaller) edge plausibly survives on clean data.

---

## 5. Exact metrics that determine whether Core has edge

Measured on **excess return vs SPY, net of costs**, on **OOS + walk-forward**:

| Metric | Definition | Edge signal |
|---|---|---|
| **Mean forward excess return** | average +10-day excess return per signal (also report +5/+20) | **> 0** |
| **Statistical significance** | t-stat of the mean, or bootstrapped 95% CI | **t > 2** / CI excludes 0 |
| **Band monotonicity** | forward return by score band | UltraGolden > Golden > Strong > Watchlist (score is informative) |
| **Hit rate** | % of signals with positive forward excess return | meaningfully > 50% |
| **Information coefficient (optional)** | rank corr(score, forward return) | positive, stable |
| **OOS persistence** | OOS metrics vs IS | OOS not collapsed (≥ ~70% of IS effect) |
| **Walk-forward stability** | per-window results | positive in **majority** of windows; no single window/regime/sector drives it |
| **Effect size vs bias+cost** | mean excess return vs (survivorship inflation + costs) | edge **clearly exceeds** the combined drag |

**"Edge" = statistically significant + monotonic by band + persistent OOS/walk-forward + large enough to survive the survivorship+cost haircut.** Anything less is "no edge."

---

## 6. Minimum evidence required before approving paid data

Approve the **paid (Sharadar) confirmation** spend **only if the free screen shows ALL of:**
1. **Statistically significant** positive mean forward excess return (t > 2 / CI excludes 0) at the +10-day horizon (and not contradicted at +5/+20).
2. **Band monotonicity** — higher score bands clearly outperform lower.
3. **OOS persistence** — the effect holds on the untouched OOS window.
4. **Walk-forward stability** — positive in the majority of windows; not one-period/one-regime.
5. **Cushion over bias+cost** — the measured edge is **large enough that, after subtracting plausible survivorship inflation (~1–4%/yr) and real costs, a positive edge would likely remain.**

If all five hold on *optimistic* free data, there is a credible chance a *real* edge survives on clean data → the small paid spend is justified. If any fail, paid data is **not** justified.

---

## 7. Decision tree

```
                ┌─────────────────────────────────────────────┐
                │  Run Core signal study on FREE daily data    │
                │  (survivorship-biased = optimistic)          │
                └───────────────────────┬─────────────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
  Core FAILS on free data      No statistically                Promising edge
  (no positive excess return,  significant edge                (all five §6 criteria
   bands not informative,      (t ≤ 2 / not monotonic /         pass on free data)
   or negative)                not persistent)
        │                               │                               │
        ▼                               ▼                               ▼
   ❌ STOP THE PROJECT          ❌ STOP THE PROJECT            ➡ PROCEED to PAID-DATA
   (Core premise invalid;       (no measurable edge even        CONFIRMATION
    $0 spent; do not fix         with bias helping;             (purchase Sharadar;
    F-B, do not buy data,        $0 spent)                       re-run on survivorship-
    do not develop S2)                                            free, point-in-time data)
                                                                        │
                                              ┌─────────────────────────┴───────────────┐
                                              ▼                                          ▼
                                   Paid data CONFIRMS edge                   Paid data does NOT confirm
                                   (criteria §5 hold on clean,               (edge was survivorship/
                                    survivorship-free data)                   noise; collapses on clean data)
                                              │                                          │
                                              ▼                                          ▼
                                   ✅ APPROVE FactsBuilder +                    ❌ STOP THE PROJECT
                                      full validation infrastructure            (apparent edge was bias;
                                      (then fix F-B, then Turbo,                 no real edge; do not fund)
                                       then full real-market validation)
```

**Hard rule:** **only after paid-data confirmation** may FactsBuilder and the full validation infrastructure be approved. No engineering beyond the minimal free screen is funded before that point.

---

## 8. What this framework deliberately avoids spending

- **$0 until the free screen passes** (and the free screen itself is a contained analysis, separately approved — not "production infrastructure").
- **No intraday data, no FactsBuilder, no Turbo, no F-B fix, no Strategy 2 work** until paid-data confirmation.
- **No large commitment on a possibly-false premise.** The biased free screen can only *overstate* edge, so a failure there ends the project for $0 — the single biggest cost-avoidance in the plan.

---

## 9. Stop gate

**STOP — decision framework only. No code, no build, no purchase; everything frozen.** The next step (separately approved) is the **minimal free-data Core signal screen** that executes §1 and applies §7. The objective remains a single answer: **does Core have a real edge worth funding?**
