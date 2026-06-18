# PHASE1_FACTSBUILDER_ARCHITECTURE

**Phase:** 1 — prerequisite architecture study for the real-market validation defined in `REAL_MARKET_VALIDATION_PLAN.md`.
**Objective:** determine whether **Strategy 1 has a real market edge** — *not* strategy optimization. **Strategy 1 and Strategy 2 are FROZEN.** No code, no implementation, no strategy change, no trading-schema change.
**Scope of this document:** architecture study · data-source requirements · point-in-time data model · historical replay architecture · dependency map · cost estimate · storage estimate — in that order. **STOP after this; build decision is the owner's.**

**Foundational principle:** the FactsBuilder is a **measurement/input-reproduction component**, not a strategy. It reproduces, from real point-in-time data, the *exact* fact DTOs the frozen strategies already consume — so Strategy 1/2 run **unchanged** behind the existing `MarketDataProvider` seam. It computes inputs; it decides nothing.

---

## 1. FactsBuilder architecture study

### 1.1 What it must produce (exact, from frozen code)
The frozen pipeline consumes these objects via `MarketDataProvider.poll() → MarketDataFrame`. The FactsBuilder must reproduce **every field** from raw data, point-in-time:

| Object | Fields the FactsBuilder must compute |
|---|---|
| `MarketFacts` | `spy_price`, `spy_sma_200`, `adx` |
| `CoreCandidateInput` | `symbol`, `direction(Long)`, `rs_rating`, `rvol`, `adv`, `trend_stage2`, `breakout{new_52w_high, base_breakout, base_days}`, `earnings{surprise_positive, days_since, aligned}` |
| `TurboCandidateInput` | `symbol`, `direction(Long/Short)`, `rvol`, `adv`, `atr`, `premarket_volume`, `gap_pct`, `above_vwap`, `catalyst`, `orb_confirmed`, `momentum_ok` |
| frame `marks` | per-symbol price at decision time |
| frame meta | `captured_at`, `market_open`, `bar_id`, `quality` (existing data-quality gate, unchanged) |

### 1.2 Decomposition into point-in-time "computors"
Each fact is produced by a small, deterministic, **point-in-time** computor that reads only completed data up to the decision timestamp:

- **Regime computor** — SPY close, SPY SMA200, ±1% band → Bull/Bear/Sideways (matches `MarketRegimeEngine`).
- **Trend computor** — SMA50/150/200 per symbol; `trend_stage2 = price>50>150>200 AND SMA200 rising`.
- **Relative-strength computor** — `rs_rating` as the cross-sectional RS rank over the **point-in-time universe** (this is a *ranking*, so it depends on the survivorship-free universe — §7).
- **Volume computors** — `adv` (trailing avg daily volume), `rvol` (daily for Core; intraday for Turbo).
- **Breakout computor** — `new_52w_high` (rolling 252-day high), `base_breakout` + `base_days` (consolidation-base detection ≥ 50 days).
- **Earnings/PEAD computor** — join the earnings feed; `surprise_positive`, `days_since` (≤10), `aligned`; valid **only after** the announcement timestamp (§8).
- **Intraday computors (Turbo)** — `atr`, `gap_pct` (open vs prior adj close), `premarket_volume`, `above_vwap` (session VWAP from completed minute bars), `orb_confirmed` (opening-range breakout), `momentum_ok`, `catalyst` (news/earnings flag).
- **Marks computor** — last completed price at the decision minute/close.

### 1.3 Assembly & cadence
- **Core frames:** one per trading day at/after the close (EOD cadence).
- **Turbo frames:** one per minute during the session (1-minute cadence), incl. pre-market for `premarket_volume`.
- Frames pass through the **existing, unchanged `quality.py` gate**; the frozen orchestrator consumes them identically to fixtures.

### 1.4 The #1 correctness risk — fact parity
The validation is only valid if each computed fact **matches D3's expected semantics exactly** (e.g., how `rs_rating`, `rvol`, `base_days`, `trend_stage2`, `aligned` are defined). A definitional mismatch silently invalidates the entire study. **Mitigation:** a fact-parity specification + reconciliation step (cross-check FactsBuilder output against the documented D3 fact definitions on known cases) is mandatory before any result is trusted.

---

## 2. Data-source requirements

Field → source mapping (vendor-agnostic; institutional-grade, point-in-time, survivorship-free):

| Source | Granularity | Feeds | Hard requirement |
|---|---|---|---|
| Daily adjusted OHLCV (NASDAQ+NYSE, **incl. delisted**) | daily | SMA50/150/200, ADV, daily RVOL, 52-w high, base, gap (prior close), RS | split/div-adjusted; delisted coverage |
| Intraday 1-minute OHLCV (incl. **pre-market**) | 1-min | VWAP, ORB, intraday ATR, premarket volume, intraday RVOL, momentum | pre/post sessions; the cost/storage driver |
| Corporate actions (splits, dividends, symbol changes) | event | point-in-time price adjustment | as-occurred dates |
| Earnings + estimates (**announcement timestamp + BMO/AMC**) | event | PEAD (`surprise_positive`, `days_since`, `aligned`) | as-first-reported; no restatements |
| SPY benchmark (daily, + intraday if needed) | daily/1-min | regime, RS denominator | same adjustment basis |
| Point-in-time sector/industry classification | as-of | sector gate (≤25%), sector breakdown | historical, not current mapping |
| Point-in-time universe/listing membership (incl. delistings) | as-of | survivorship-free universe (§7) | the critical anti-bias source |
| Short borrow / locate + fees | daily | Turbo short feasibility & cost | else flag shorts "borrow-unverified" |
| Exchange calendar (holidays, half-days, session times) | as-of | session / EOD / flatten timing | NY session |

**Procurement note:** specific vendors are the owner's decision; the *requirement* is point-in-time + delisted coverage + intraday depth + timestamped earnings. A **reduced-scope option** exists: daily-only first (validates Core + Turbo-daily proxies), deferring expensive intraday until Core's edge is confirmed.

---

## 3. Point-in-time data model

A **separate validation/backtest datastore** — **NOT** the trading PostgreSQL schema (which stays frozen). Conceptual tables with as-of access:

- `daily_bars(symbol, date, o,h,l,c,v, adj_factor, listed)` — partitioned by date.
- `minute_bars(symbol, ts, o,h,l,c,v, session∈{pre,regular,post})` — partitioned by date (large).
- `corporate_actions(symbol, ex_date, type, ratio_or_amount)`.
- `earnings(symbol, announce_ts, bmo_amc, eps_actual, eps_estimate, surprise)`.
- `universe_membership(symbol, start_date, end_date, exchange, status)`.
- `sector_map(symbol, sector_id, start_date, end_date)`.
- `borrow(symbol, date, available, fee_bps)`.
- `benchmark(spy)` in `daily_bars`/`minute_bars`.

**Access discipline (point-in-time):**
- Every read is **as-of a decision timestamp**: return only rows with `effective_ts ≤ decision_ts`.
- **Bi-temporal** handling for earnings/fundamentals (`knowledge_date` vs `effective_date`) → use **as-first-reported** values only; never restated.
- Price adjustment applied **as-of** (no future split ratio leaking into past bars — §8).
- Columnar storage (e.g., Parquet/partitioned) for the minute data; the trading PG is untouched.

---

## 4. Historical replay architecture

- A new **`HistoricalMarketDataProvider`** implementing the existing `MarketDataProvider` ABC — a sibling of `ReplayMarketDataProvider`. It pulls point-in-time data, invokes the FactsBuilder per cadence, and emits `MarketDataFrame`s.
- **Event-driven, timestamp-ordered replay** interleaving Core EOD frames and Turbo 1-minute frames; a ≥200-day warmup precedes the first emitted signal frame.
- The **frozen** `PipelineOrchestrator` (Strategy 1) — and, separately, `Strategy2Orchestrator` — consume these frames **unchanged**.
- **Cost/fill layer (new, validation-only):** a cost-aware execution wrapper applies commission, slippage, borrow, gap-through and session-flatten fills (per `REAL_MARKET_VALIDATION_PLAN.md` §9) at the fill boundary. This is **additive validation infrastructure**, not a change to Strategy 1's execution logic — to be designed in a later phase.
- **Harness flow:** `HistoricalMarketDataProvider → [frozen] orchestrator → cost-aware target → portfolio (D6) → D14 read-only metrics → OOS / walk-forward evaluation → pass/fail`.
- **Signal→fill separation** (next-bar fill) and **shift-by-one sanity test** are enforced in the harness (§8 of the validation plan).

---

## 5. Dependency map

```
[NEW validation store]  raw point-in-time data (daily, minute, actions, earnings,
                        universe, sector, borrow, SPY, calendar)
        │  (as-of reads only)
        ▼
[NEW] FactsBuilder computors  (regime, trend, RS, RVOL, ADV, breakout, PEAD,
        │                      ATR, gap, VWAP, ORB, momentum, marks)  ── must match D3 fact parity (risk #1)
        ▼
[NEW] HistoricalMarketDataProvider  ── implements existing MarketDataProvider ABC
        │  emits MarketDataFrame (existing) → existing quality.py gate (unchanged)
        ▼
[FROZEN] PipelineOrchestrator (S1)  /  Strategy2Orchestrator (S2)   ── consume frames unchanged
        ▼
[NEW] cost-aware execution layer (commission/slippage/borrow/gaps)  ── validation-only, additive
        ▼
[FROZEN] D5 execution · D6 portfolio · D14 metrics/gate (read-only)
        ▼
[NEW] backtest runner → OOS + walk-forward evaluation → pass/fail report

UNCHANGED: D1–D6 engines, EX-1, MarketDataProvider ABC, MarketDataFrame, quality gate,
           D3 fact DTOs, Strategy 1, Strategy 2, trading PostgreSQL schema.
NEW:       validation datastore, FactsBuilder, HistoricalMarketDataProvider,
           cost layer, backtest runner. (All additive; isolated from the frozen system.)
```

---

## 6. Cost estimate (budgeting ranges — not quotes; vendor/scope-dependent)

**Data acquisition (the dominant cost):**

| Item | Indicative range | Notes |
|---|---|---|
| Daily adjusted OHLCV + corporate actions, **survivorship-free incl. delisted** | ~$1k–$10k (one-time or per-yr) | relatively affordable |
| **Intraday 1-minute history (full US universe, multi-year, incl. pre-market)** | **~$10k–$50k+** | the cost driver; required only for Turbo |
| Earnings + estimates, point-in-time timestamped | ~$3k–$20k / yr | required for PEAD |
| Point-in-time sector + universe membership | ~$1k–$10k | often bundled |
| Short borrow / locate history | variable / sometimes premium | needed for realistic Turbo shorts |

**Engineering effort (build, later phase):** FactsBuilder + computors + parity reconciliation + HistoricalMarketDataProvider + cost layer + backtest runner ≈ **multiple person-weeks (L)**.
**Compute/infra:** modest — a single workhorse box or small cloud instance for batch replay ≈ low hundreds–low thousands.

**De-risking option:** **daily-only Phase-2a** (validate Core + a daily Turbo proxy) avoids the ~$10k–$50k intraday spend until Core's edge is confirmed. Recommended given the objective is "does it work?" not optimization.

---

## 7. Storage estimate

Driver = 1-minute bars. Rough sizing for ~10,000 symbols (incl. delisted) × ~7 years:

| Dataset | Rows (≈) | Raw | Compressed (columnar) |
|---|---|---|---|
| **Minute bars** (~500 bars/day incl. pre-market × ~1,764 days) | ~9 billion | **~300–500 GB** | **~60–100 GB** |
| Daily bars (~252/yr × 7yr) | ~18 million | ~1 GB | <200 MB |
| Corporate actions / earnings / universe / sector / borrow | small | < 1–2 GB | small |
| **Total** | — | **~0.3–0.5 TB raw** | **~70–110 GB compressed** |

- Manageable on commodity storage; minute data dominates.
- **Reduced-scope (daily-only) storage: < 2 GB total** — trivial.
- Recommend columnar/partitioned storage (by date) with on-read as-of filtering; keep it **isolated from the trading PostgreSQL**.

---

## 8. Risks & decision framing

- **R1 (highest): fact parity.** If FactsBuilder definitions diverge from D3's expectations, the validation is invalid. Mandatory parity spec + reconciliation before trusting any number.
- **R2: intraday data cost/quality.** Pre-market + 1-min depth is expensive and vendor-variable; the daily-only de-risk path mitigates spend.
- **R3: survivorship & look-ahead** are design-critical (validation plan §7–§8); the data model and harness must enforce them or results are meaningless.
- **R4: cost-layer realism.** Backtest fills must include commission/slippage/borrow or the edge is overstated.
- **Expectation (honest):** consistent with `STRATEGY1_IMPROVEMENT_ROADMAP.md`, this infrastructure will most likely show **Turbo carries the edge and Core (F-B) fails** on real data — which is exactly the question worth answering before any improvement spend.

---

## 9. Stop gate

**STOP — Phase 1 architecture study only.** No code, no implementation, no strategy change, no trading-schema change; Strategy 1 and Strategy 2 remain frozen. After your review/approval, the next decision is whether to **fund the build** (data acquisition + FactsBuilder + historical replay + cost layer) — with the **daily-only de-risk path** available to confirm Core/Turbo edge before committing to expensive intraday data.
