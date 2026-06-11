# CORE_PROOF_OF_EDGE_FEASIBILITY

**Type:** Feasibility assessment only. **No code. No implementation. No FactsBuilder build. No Turbo. No data purchases.**
**Question to answer:** *Can Core be realistically validated with **daily-only** data — cheaply — before any spend on intraday datasets?*
**Frozen:** Strategy 1, Strategy 2, all shared layers, the trading schema. This is a paper assessment.

---

## Headline assessment (the answer first)

**YES — Core can be realistically validated with daily data only, and it should be the gate before any intraday spend.**

Core is an **EOD / daily swing engine**. Every fact it consumes is **daily-computable** — none requires 1-minute data:

| Core fact | Daily-computable? | From |
|---|---|---|
| regime (SPY vs SMA200, ±1%) | ✅ | SPY daily |
| `trend_stage2` (price>SMA50>150>200, SMA200 rising) | ✅ | daily closes |
| `rs_rating` (cross-sectional relative strength) | ✅ | universe daily closes |
| `rvol`, `adv` | ✅ | daily volume |
| `breakout` (52-week high = 252d; base ≥ 50d) | ✅ | daily highs/closes |
| `earnings` / PEAD (surprise, ≤10 days) | ✅ | earnings dates + surprise |

**Intraday (1-minute) data is needed only for Turbo — not for Core.** Therefore the expensive intraday tier (~$10k–$50k+) is **not required** to answer "does Core have edge." The only thing worth a *small* spend is a **survivorship-free daily feed (incl. delisted)**.

**Recommended two-tier, cost-minimizing path:**
1. **Free, survivorship-biased screen ($0):** run the signal-level study on free daily data (current-listed names only). This data is *optimistic* (survivorship bias inflates results). **If Core shows no edge even here → definitive STOP at $0.**
2. **Low-cost survivorship-free confirmation (~$20–$60/month, only if step 1 passes):** confirm on delisted-inclusive daily data before funding the full project.

This is the cheapest possible way to determine Core's edge.

---

## 1. Exact minimum dataset required (Core only, daily)

| # | Data | Needed for | Minimum |
|---|---|---|---|
| 1 | **Daily adjusted OHLCV** for the candidate universe (NASDAQ+NYSE, ADV≥500k) | SMA50/150/200, RS, RVOL, ADV, 52-w high, base, **forward returns** | ~5 years + **200-day warmup**; split/div-adjusted |
| 2 | **Corporate actions** (splits/dividends) | correct adjustment | as-occurred |
| 3 | **SPY daily** | regime + RS benchmark | same window |
| 4 | **Earnings dates + surprise** | PEAD | timestamped if possible (can be approximated/deferred — see §3) |
| 5 | **Point-in-time universe / delisted listing** | survivorship-free selection + RS denominator | the one item worth paying for |
| 6 | **Sector classification** | sector-exposure gate | *optional for a signal-edge test* — relax with a noted caveat if unavailable |

**Footprint: < 2 GB. No intraday. No borrow data (Core is long-only).**

---

## 2. Free / low-cost data sources (availability/pricing must be verified — they change)

| Source | Tier | Covers | Key limitation |
|---|---|---|---|
| **Stooq** | Free | US daily OHLCV | thin/uneven delisted coverage → survivorship risk |
| **Yahoo Finance (yfinance)** | Free | daily adjusted, current names | **survivorship-biased** (delisted mostly missing), rate-limited, ToS |
| **Alpha Vantage** | Free tier | daily adjusted, some earnings | rate-limited; limited delisted |
| **Nasdaq Data Link (free sets)** | Free/low | some daily | quality/coverage varies |
| **Tiingo** | ~$10–30/mo | daily adjusted, decent coverage | delisted coverage partial |
| **Financial Modeling Prep (FMP)** | Free/low | earnings calendar + **surprise**, some daily, sector | point-in-time/as-first-reported weaker |
| **EOD Historical Data (eodhd.com)** | ~$20–60/mo | **daily incl. delisted** + corporate actions + earnings | strong low-cost survivorship-free candidate |
| **Sharadar SEP/SF (via Nasdaq Data Link)** | low-hundreds | **survivorship-free daily incl. delisted** + point-in-time fundamentals | best point-in-time quality at modest cost |
| **Polygon.io** | ~$30–200/mo | daily + corporate actions, some delisted | mid-cost |

**Takeaway:** free sources fully cover **current-name** daily OHLCV (good enough for the $0 biased screen). **Survivorship-free + earnings-surprise** is reliably solved only at the **~$20–60/month** tier (EODHD or Sharadar) — far below the intraday tier.

---

## 3. Gap analysis (required vs. available)

| Requirement | Free availability | Gap | Resolution |
|---|---|---|---|
| Daily adjusted OHLCV (current names) | ✅ Good (Yahoo/Stooq/AlphaVantage) | none | free |
| **Survivorship-free / delisted daily** | ❌ Poor on free | **CRITICAL GAP** | ~$20–60/mo (EODHD/Sharadar) — the only spend worth making before intraday |
| Corporate actions | ⚠️ Partial free | minor | bundled in low-cost feeds |
| Earnings + **surprise** (point-in-time) | ⚠️ Partial (FMP/AlphaVantage) | moderate | use FMP/low-cost; **or approximate/defer PEAD** in a first pass |
| Point-in-time sector | ❌ Mostly paid | moderate | **relax the sector gate** for the signal-edge test (noted caveat) |
| RS denominator (universe) | derived from #1 | none (but quality depends on survivorship) | resolved with survivorship-free data |
| Intraday 1-min | n/a for Core | **not needed** | deferred to Turbo only |

**Single material gap: survivorship-free daily data.** Everything else is free, derivable, approximable, or deferrable. The expensive intraday gap is irrelevant to Core.

---

## 4. Daily-only validation architecture (description only — no code)

- A **daily historical provider** behind the existing `MarketDataProvider` seam (sibling of the fixture provider) — emits one frame per trading day after a ≥200-day warmup.
- A **Core-daily FactsBuilder** computing the §1 facts point-in-time (only bars with date ≤ decision date).
- **Fact-parity guarantee by reuse:** feed the computed `CoreCandidateInput` + `MarketFacts` into the **frozen** `SelectionEngine.run_core(...)` and `MarketRegimeEngine` — so scoring, classification, regime, and eligibility are the **actual D3 logic**, not a re-implementation. The parity surface shrinks to just the raw fact math (SMA stack, RS, RVOL, ADV, 52w/base, PEAD).
- **Primary test — signal-level event study:** measure forward returns (+5/+10/+20 trading days, net of light costs) of Core entry signals, segmented by score band; OOS split + walk-forward windows. This **isolates Core's selection edge from the known-broken Core exit (F-B)**.
- **Secondary (optional) — full Core sim** (frozen, incl. F-B) for context only.
- **Isolated & additive:** reuses frozen D3/D6 read-only; **no** change to Strategy 1/2 or the trading schema; daily data in a separate small store/files.

---

## 5. Estimated build effort

| Component | Effort |
|---|---|
| Data loader + ingestion to the daily contract (CSV/Parquet) | ~2–4 days |
| Core-daily FactsBuilder + **fact-parity reconciliation** | ~3–5 days |
| Daily historical provider (MarketDataProvider impl) | ~1–2 days |
| Event-study evaluator (forward returns, bands, t-stats, OOS, walk-forward) | ~3–5 days |
| Light cost model + runner + harness tests | ~2–3 days |
| **Total** | **~2–3 person-weeks (Medium)** |

*(The $0 biased screen could be a smaller subset — loader + FactsBuilder + event study — in ~1–1.5 weeks.)*

---

## 6. Estimated validation effort (after build)

| Activity | Effort |
|---|---|
| Data acquisition + cleaning (adjustments, delisting handling, survivorship) — **usually the longest** | ~3–7 days |
| Fact-parity reconciliation on real samples | ~1–2 days |
| Run signal study + OOS + walk-forward + regime/sector segmentation | ~1–2 days |
| Analysis + written edge report | ~1–2 days |
| **Total** | **~1–2 weeks**, dominated by data wrangling |

---

## 7. Exact success criteria to justify funding the full FactsBuilder project

Fund the full project (intraday + Turbo + full sim) **only if** the Core daily signal study shows:

1. **Positive, statistically-significant forward returns** net of costs — Core entry signals' mean +10-day excess return **> 0** with **t-stat > ~2** (or bootstrapped CI excludes 0).
2. **Band monotonicity** — higher score bands (UltraGolden > Golden > Strong > Watchlist) show higher forward returns (confirms the score is informative).
3. **Out-of-sample persistence** — the edge holds on the untouched OOS window (not just in-sample).
4. **Walk-forward stability** — positive in the **majority** of forward windows; no single window/regime/sector drives it.
5. **Survives the survivorship check** — the edge remains on **survivorship-free** data (not only on optimistic free data).

- **All five pass → GREEN:** Core has real selection edge → fund the full FactsBuilder, fix F-B (exit), then Turbo + full validation.
- **Any fail → STOP:** do not fund intraday data, do not fix F-B, do not develop Strategy 2 — Core's premise is not validated.

---

## 8. Conclusion & recommendation

- **Core is fully validatable on daily-only data** — it needs no intraday, so the costly intraday tier is irrelevant to answering "does Core have edge."
- **The only real dependency is survivorship-free daily data (~$20–60/month)** — and even that can be deferred behind a **$0 survivorship-biased free screen** that can only *overstate* edge: if Core fails the free screen, stop immediately at zero cost.
- **Recommended next step (still no purchase):** approve the **build of the daily-only harness** (~1–3 weeks), run the **$0 free-data screen first**; spend the small monthly fee for survivorship-free confirmation **only if** the free screen is promising. This determines Core's real edge at minimal cost before any large investment.

---

**STOP — feasibility assessment only. No code, no build, no data purchase; Strategy 1 & Strategy 2 frozen. Awaiting your decision: approve the daily-only harness build (then the $0 free screen), or hold.**
