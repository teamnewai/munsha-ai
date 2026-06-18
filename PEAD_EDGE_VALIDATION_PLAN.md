# PEAD_EDGE_VALIDATION_PLAN

**Type:** Plan / decision framework only. **No code. No experiments. No implementation.** Strategy 1, Strategy 2, Core logic, Turbo logic, and the database schema are **frozen**; no FactsBuilder, no infrastructure, no new strategy versions.
**Purpose:** the final low-cost test of the **one remaining uncertainty** from `CORE_PROOF_OF_EDGE_RESULTS.md` — whether Core's **top-conviction (PEAD-driven) signals** have a real edge.

---

## 0. Why this is the decisive remaining test (grounded fact)

D3's Core score = **Regime 20 · RS 20 · Breakout 20 · RVOL 15 · Trend 15 · PEAD 10 = 100.**
**Without the PEAD component, the maximum achievable Core score is 90** → only **Strong (90–94)** and **Watchlist (<90)** can ever be produced. **Golden (95–99) and UltraGolden (100) are mathematically impossible without PEAD points.**

This is exactly why the free screen produced **no** top-band signals (earnings were deferred). Therefore:
- **The top bands *are* the PEAD-driven signals.** Reconstructing them **requires** earnings data, and measuring their forward returns **is** the PEAD edge test.
- This single test closes the one gap the results document left open. **It is the last meaningful low-cost gate** before continue/terminate.

---

## 1. Minimum earnings data required

Per symbol, over the price-data window:
- **Earnings announcement date** (with BMO/AMC timing if available).
- **EPS actual** and **EPS estimate** (consensus) → to derive the **surprise**.

From these, the three `EarningsFacts` fields D3 consumes are derived:
- `surprise_positive` = (EPS actual > EPS estimate) — a beat.
- `days_since` = trading days since the announcement (gate: **≤ 10**, `PEAD_MAX_DAYS`).
- `aligned` = surprise direction matches the trade direction (Core is Long → a *positive* surprise is aligned).

**Nothing else is needed** — no intraday, no fundamentals beyond EPS actual/estimate. It joins to the price data already in hand (same universe, same period).

---

## 2. Cheapest source of earnings-surprise data

| Option | Cost | Note |
|---|---|---|
| **Alpha Vantage `EARNINGS`** (free tier) | **$0** | quarterly EPS actual+estimate+surprise; rate-limited |
| **Financial Modeling Prep** earnings calendar/surprises (free/low tier) | **$0–low** | good surprise coverage |
| **GitHub/Kaggle-mirrored earnings datasets** | **$0** | static historical EPS surprise CSVs (the only path reachable inside this network-restricted sandbox, where data APIs are egress-blocked) |
| **Owner-exported free file** (CSV from any of the above) | **$0** | cleanest given the egress allowlist; owner runs the free export once |

**Reality of this environment:** outbound egress is allow-listed to **GitHub + pypi only**; the earnings APIs above are **blocked here**. So the practical free path is **a GitHub-hosted earnings dataset or an owner-provided CSV** (same survivorship-biased S&P-500/2013–2018 scope as the price data). **Net cost: $0.**

---

## 3. How Golden / UltraGolden signals will be reconstructed

A small **incremental** addition to the existing free screen (reuse the price data, the frozen D3 `run_core`, and the forward-return harness already used — *no new infrastructure*):
1. For each candidate stock-day, **join the most recent earnings announcement** and check it is within **≤ 10 trading days**.
2. Build `EarningsFacts(surprise_positive, days_since, aligned)` and attach it to the `CoreCandidateInput` (previously `earnings=None`).
3. Re-run **frozen D3 `run_core`** → PEAD points are now scored → some signals reach **Golden (95–99) / UltraGolden (100)**.
4. Measure the **forward returns (+5/+10/+20d, excess vs SPY-proxy, net of cost)** of the **Golden+UltraGolden** signals specifically — and compare them against the Strong/Watchlist bands already shown to have no edge.

Because only a recent positive earnings surprise can lift a candidate into the top bands, **the top-band signal set is, by construction, the PEAD-aligned subset** → testing it *is* testing PEAD.

---

## 4. How many years of data required

- **Match the available free price history (~5 years, 2013–2018)** as the baseline.
- PEAD top-band signals are **rarer** (they require a positive earnings beat within 10 days *plus* all other Core gates), so 5 years yields a **modest** sample.
- **If the top-band sample is too small for power, extend** to a longer free price+earnings history (e.g., 8–10 years) if obtainable at $0; otherwise accept the sample-size limit and treat low power as a non-pass (see §7).

---

## 5. Expected sample size (estimate, with the main risk flagged)

- The prior screen produced **1,751** de-overlapped Strong/Watchlist signals over 5 years.
- The PEAD-aligned subset (earnings beat within 10 days, simultaneously meeting all Core gates) is a **fraction** of these — a rough expectation of **~100–350** top-band signals over 5 years (possibly fewer after de-overlap).
- **This is the single biggest risk of the test: the sample may be too small for statistical significance.** A small sample that shows no significant edge is itself decision-relevant (no positive evidence → fail), but a small sample that looks faintly positive may be **underpowered** rather than conclusive — see §7/§8.

---

## 6. Statistical tests

On excess forward returns (vs SPY-proxy, net of cost) of the top-band signals:
1. **One-sample t-test** vs 0 at +5/+10/+20d (+ bootstrapped 95% CI, win rate).
2. **Two-sample test (the key test):** are **top-band (Golden+UltraGolden)** forward returns **significantly greater** than the **lower bands (Strong/Watchlist)**? This directly tests whether **adding PEAD creates separation/edge**.
3. **Band monotonicity** across all four bands now (UltraGolden ≥ Golden > Strong > Watchlist).
4. **Out-of-sample + walk-forward** (subject to the small-sample limit).
5. **Clustering caveat:** de-overlap signals; treat t-stats as indicative given cross-sectional/earnings-cluster correlation.

---

## 7. Exact pass / fail criteria

**PASS (PEAD shows edge) — ALL of:**
1. Top-band mean **excess forward return > 0** and **statistically significant** (t > 2 / CI excludes 0) at +10d (not contradicted at +5/+20).
2. Top bands **significantly greater** than the lower bands (two-sample test) — PEAD adds real separation.
3. **Monotonic gradient** (UltraGolden ≥ Golden > Strong > Watchlist).
4. **Effect size clearly exceeds** the survivorship + cost drag (so a real, smaller edge could survive on clean data).
5. Direction **consistent** across OOS / walk-forward to the extent sample power allows.

**FAIL — any of:** top bands not significantly positive · not greater than lower bands · no monotonic separation · effect within the bias/cost noise.

**INCONCLUSIVE-as-FAIL:** if the top-band sample is too small for power (no significant result either way), there is **no positive evidence** → treated as **FAIL for funding purposes** (do not fund on absence of evidence). The only remedy would be more (still-cheap) earnings/price history; if that too is unavailable, the cheap avenue is exhausted.

---

## 8. Can this PEAD test answer the remaining uncertainty? (the most important question)

**Yes — this is the test that resolves the one open gap, and it is the last meaningful low-cost test.** Because the top bands are *defined by* PEAD (§0), reconstructing and measuring them is a **complete** test of the remaining "untested top-conviction signals" uncertainty.

**With three honest limits on how *definitively* it answers:**
1. **Sample power** — the top-band set may be small; an underpowered null is "no positive evidence," not "proven no edge." (Handled by §7 INCONCLUSIVE-as-FAIL.)
2. **Survivorship bias persists** — still optimistic free data; therefore a **PASS would still require paid, survivorship-free confirmation** before any build (it cannot, by itself, justify the full infrastructure).
3. **Fact parity** — RS approximation + the `surprise`/`aligned` definitions must match D3's intent; a parity error could distort the top-band reconstruction.

Net: it **conclusively answers** "do Core's PEAD-driven top signals show edge on free data?" A clear negative ends the inquiry cheaply; a clear positive earns a paid confirmation — but in **no case** does it alone justify funding the full build.

---

## 9. Cost · Effort · Time

| Dimension | Estimate |
|---|---|
| **Cost** | **$0** (free earnings data: Alpha Vantage / FMP free tier, GitHub dataset, or owner export) |
| **Effort** | **Small — ~2–4 days** of throwaway research analysis (reuse existing price data + frozen D3 + forward-return harness; add the earnings join + top-band stats). No infrastructure. |
| **Time** | **~2–4 days**, dominated by sourcing/cleaning earnings (date alignment, BMO/AMC, estimate matching) |

---

## 10. Final recommendation (decision tree)

This is the **final low-cost gate.** After it:

```
            ┌──────────────────────────────────────────────┐
            │  PEAD top-band edge test (free, ~$0, ~few days)│
            └───────────────────────┬──────────────────────┘
                                    │
            ┌───────────────────────┼───────────────────────┐
            ▼                                               ▼
   PEAD FAILS / INCONCLUSIVE-as-FAIL                 PEAD SUCCEEDS
   (top bands no significant edge,                   (top bands significantly
    or not > lower bands, or underpowered)            positive, > lower bands,
            │                                          monotonic, beyond bias+cost)
            ▼                                               ▼
   ❌ RECOMMEND TERMINATING THE PROJECT          ➡ RECOMMEND PAID-DATA CONFIRMATION
   (both broad Core signals AND the top-            (survivorship-free, point-in-time
    conviction PEAD signals show no edge             re-test of the top-band edge —
    on optimistic free data; all cheap               NOT the full build yet)
    avenues exhausted)                                      │
                                                            ▼
                                              Only if paid confirmation also holds:
                                              approve FactsBuilder + full validation.
```

- **PEAD fails → terminate the project.** There would be no remaining cheap thread: the broad Core signals already showed no edge, and the top-conviction PEAD signals would have failed too — on data biased to *help* them.
- **PEAD succeeds → fund only the paid survivorship-free confirmation** (the cheapest paid step, ~$20–60/mo Sharadar/EODHD), not the full infrastructure. The full FactsBuilder/validation build is approved **only after** paid confirmation also holds.

---

**Bottom line:** Yes — the PEAD top-band test is **the last meaningful low-cost test** before the continue/terminate decision. It directly resolves the only open question, costs ~$0 and a few days, and cleanly routes to **terminate** (on failure) or **paid confirmation** (on success). No code, no experiments run; awaiting your go-ahead to execute it.
