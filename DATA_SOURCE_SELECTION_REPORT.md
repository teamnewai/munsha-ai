# DATA_SOURCE_SELECTION_REPORT

**Type:** Data-source decision study only. **No code. No architecture. No implementation.**
**Goal:** select the final data provider for **Core (daily) validation** before any engineering begins.
**Scope:** Core needs **daily, survivorship-free, point-in-time** US-equity data + corporate actions + earnings history. (Intraday is a Turbo concern — out of scope.)
**Caveat:** provider features and **pricing change frequently**; figures below are approximate (knowledge as of early 2026) and **must be verified directly with each vendor before purchase.**

---

## 1. The six things that actually decide this

For Core, the requirements that make-or-break the validity of the test (in priority order):
1. **Survivorship-bias protection** (incl. delisted names) — without it, results are inflated and meaningless.
2. **Point-in-time universe** (as-of membership, not today's listings).
3. **Corporate actions** (splits/dividends) for correct adjustment.
4. **Earnings history** (dates + surprise) for PEAD.
5. **Cost** (we want the cheapest that satisfies 1–4).
6. **Access** (clean cross-platform API for batch historical pull).

---

## 2. Candidate providers — comparison

Legend: ✅✅ excellent · ✅ good · ⚠️ partial/weak · ❌ absent.

| Provider | Approx. pricing* | Delisted coverage | Corporate actions | Earnings history | Survivorship protection | Point-in-time universe | Access/API |
|---|---|---|---|---|---|---|---|
| **Sharadar** (via Nasdaq Data Link) | ~$ low-hundreds / yr (personal) | ✅✅ (SEP incl. delisted) | ✅ | ✅ (SF1 fundamentals/earnings, PIT) | ✅✅ (purpose-built PIT) | ✅ (PIT tickers + fundamentals) | ✅ REST/SDK, cross-platform |
| **Norgate Data** | ~$30–80 / mo | ✅✅ | ✅ | ⚠️ (price/index-focused; earnings weak) | ✅✅ (built for survivorship-free backtests) | ✅✅ (**best** — PIT index constituents) | ⚠️ NDU tool, Windows-centric (+Python pkg) |
| **EOD Historical Data (EODHD)** | ~$20–80 / mo | ✅ | ✅ | ✅ | ✅ (delisted incl.) | ⚠️ (limited PIT membership) | ✅ REST, easy |
| **Polygon.io** | ~$30–200 / mo | ✅ (delisted tickers) | ✅ | ⚠️ (financials; weak surprise/PIT) | ⚠️ | ⚠️ | ✅✅ excellent API |
| **Financial Modeling Prep (FMP)** | ~$20–80 / mo | ⚠️ | ✅ | ✅✅ (earnings surprise strong) | ⚠️ | ⚠️ | ✅ REST |
| **Tiingo** | ~$10–50 / mo | ⚠️ partial | ✅ | ⚠️ | ⚠️ | ❌ | ✅ REST |
| **Free: Yahoo (yfinance) / Stooq** | $0 | ❌ | ⚠️ | ⚠️ | ❌ (biased) | ❌ | ✅ (unofficial) |
| **CRSP** (institutional reference) | $$$$ (thousands+, academic via WRDS) | ✅✅ | ✅✅ | ✅✅ | ✅✅ (gold standard) | ✅✅ | ✅ (institutional) |

\* *Approximate; verify current pricing/tiers directly. "Personal/retail" vs "professional/redistribution" tiers differ substantially.*

---

## 3. Requirement-by-requirement read

- **Survivorship-bias protection (most critical):** only **Sharadar**, **Norgate**, and (institutionally) **CRSP** are genuinely built survivorship-free. **EODHD/Polygon** include delisted prices but are weaker on *point-in-time* discipline. Free sources fail outright.
- **Point-in-time universe:** **Norgate** is best (PIT index constituents designed for backtesting); **Sharadar** is strong (PIT tickers/fundamentals); others ⚠️.
- **Corporate actions:** broadly available in all paid options.
- **Earnings history (PEAD):** **Sharadar** (via fundamentals) and **FMP** (surprise) are strongest; **Norgate is weak here** — its biggest gap for Core, which uses PEAD.
- **Cost:** **Tiingo/EODHD/FMP** cheapest; **Sharadar/Norgate** modestly higher but justified by survivorship quality; **CRSP** out of range.
- **Access:** **Polygon/EODHD/Sharadar** clean cross-platform APIs; **Norgate** is Windows-tool-centric (friction for a headless/Linux pipeline).

---

## 4. Ranking (cost / quality for Core daily validation)

1. **Sharadar (Nasdaq Data Link)** — best overall balance: survivorship-free **and** point-in-time **and** earnings **and** actions in one dataset, clean API, retail cost. CRSP-like rigor at a fraction of the price.
2. **Norgate Data** — best survivorship-free prices + PIT universe, but **weak earnings** (would need a 2nd source for PEAD) and Windows-centric access.
3. **EODHD** — cheapest single-vendor that still has delisted + earnings + actions; weaker point-in-time fundamentals.
4. **Polygon.io** — excellent API + delisted prices, but weak earnings/PIT — more an intraday/real-time play.
5. **FMP** — strong earnings surprise, but weak survivorship/PIT — not safe as the sole source.
6. **Tiingo** — budget daily, but weak survivorship/PIT — unsuitable as the validation source of truth.
7. **Free (Yahoo/Stooq)** — $0, but survivorship-biased → valid **only** as the zero-cost pre-screen, never as the final validation source.
- *CRSP excluded from the practical ranking on cost; it is the quality benchmark the retail options are measured against.*

---

## 5. Recommendation (one provider)

# ✅ Sharadar (via Nasdaq Data Link)

**Single-vendor selection for Core validation.** It is the only retail-priced option that satisfies **all six** requirements at once — survivorship-free + point-in-time + delisted + corporate actions + earnings/fundamentals — through one clean, cross-platform API.

---

## 6. Why it is the best cost/quality choice

- **It directly removes the failure mode this whole study exists to prevent.** The entire reason we are doing real-market validation is to escape bias. Sharadar is **purpose-built for point-in-time, survivorship-free quant research** — the same property (CRSP-grade) that makes a backtest trustworthy — at retail cost rather than institutional cost.
- **It is the only single source that covers every Core fact.** Core consumes prices (SMA/RS/RVOL/ADV/52w/base) **and** earnings/PEAD. Sharadar's SEP (survivorship-free prices) + SF1 (point-in-time fundamentals/earnings) + ACTIONS + TICKERS cover all of them — so **no second purchase** is needed. Norgate (the closest rival) would force a separate earnings feed because its PEAD coverage is weak.
- **Access fits a headless pipeline.** A cross-platform REST/SDK suits the Linux/PostgreSQL environment; Norgate's Windows-tool dependency is real friction.
- **Cost is proportionate to the decision.** A few hundred dollars/year is trivial against the alternative — funding the full FactsBuilder + intraday project (~$10k–$50k+) on a *possibly false* premise. Sharadar is the small, correct insurance spend that makes the go/no-go answer **trustworthy**.

**Two practical notes (still no purchase):**
1. **Do the $0 free screen first.** Run the Core signal study on free (survivorship-biased) data; since bias can only *overstate* edge, **failing the free screen = STOP at $0** and Sharadar is never bought. Purchase Sharadar **only** to confirm a *promising* free result.
2. **Budget fallback:** if the owner wants the absolute lowest sticker price and accepts slightly weaker point-in-time fundamentals, **EODHD (#3)** is the cheaper single-vendor alternative; **Norgate (#2)** is preferable only if PEAD is deferred and a Windows data step is acceptable.

---

## 7. Decision summary

| Question | Answer |
|---|---|
| Final provider | **Sharadar (Nasdaq Data Link)** |
| Why | only retail-priced source that is survivorship-free **and** point-in-time **and** covers earnings — one API, one purchase |
| Approx. cost | ~$ low-hundreds / year (verify current pricing) |
| Buy now? | **No** — run the $0 free survivorship-biased screen first; purchase Sharadar only if that screen is promising |
| Runner-up | Norgate (best universe, weak earnings) |
| Budget option | EODHD |
| Never-as-sole-source | Tiingo, FMP, free feeds (survivorship/PIT weakness) |

---

**STOP — data-source decision study only. No code, no architecture, no implementation, no purchase. Recommendation: select Sharadar as the final provider, to be purchased only after the $0 free-data screen warrants it.**
