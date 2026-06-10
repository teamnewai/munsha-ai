# MARKET_DATA_FIXTURE_ARCHITECTURE (OR-2)

**Type:** Pre-implementation architecture review. **Architecture only — no implementation, no data authored yet.**
**Derived from (source-verified):** `src/app/marketdata/replay.py` (fixture spec keys) · `src/app/run.py` (`load_fixtures`, `MARKET_DATA_FIXTURES`) · D3 `constants.py` thresholds + RegimeEngine · `P-VALIDATION_ARCHITECTURE.md` (policy) · `FIRST_PAPER_CAMPAIGN_READINESS_REVIEW` (OR-2 blocker).
**Status:** Architecture only — implementation forbidden until owner approval.
**Phase:** OR-2 — deterministic replay-fixture dataset for the first paper-validation campaign.

**Invariants preserved:** PostgreSQL **sole source of truth** · Redis **non-authoritative** · Portfolio ⟂ Risk ⟂ Execution · **no strategy / risk / execution / schema changes · no TradingView · no IBKR · no live trading** · the fixture is **inert data** consumed by the existing `ReplayMarketDataProvider`; it adds no code and changes no component.

---

## 1. Dataset Structure
A single deterministic dataset = an **ordered list of frame specs**, one per trading cycle. Each frame = one market "tick" the orchestrator processes (market facts + candidates + marks). The dataset is partitioned conceptually into **regime segments** over ≥30 NY trading days, sized to yield ≥200 closed paper trades across Long and Short, multiple sectors, and ≥2 regimes.

```
dataset = [ frame_0, frame_1, … , frame_N ]   # ordered; replayed in sequence
frame    = { captured_at, market_open, market_facts, core[], turbo[], marks, bar_id? }
```

## 2. Fixture Format (exact — matches `ReplayMarketDataProvider`)
Each frame spec is a JSON object with **exactly the keys the provider parses** (no schema change; values are JSON strings for Decimals):
```jsonc
{
  "captured_at": "2026-06-10T14:30:00+00:00",   // ISO-8601 (UTC); also the bar_id source
  "bar_id": "20260610-1430",                     // optional explicit idempotency key (unique)
  "market_open": true,
  "market_facts": { "spy_price": "500", "spy_sma_200": "470", "adx": "25" },
  "core":  [ { "symbol":"AAPL","direction":"Long","rs_rating":"95","rvol":"2.5",
               "adv":1000000,"trend_stage2":true,
               "breakout":{"new_52w_high":true,"base_breakout":true,"base_days":60},
               "earnings":{"surprise_positive":true,"days_since":3,"aligned":true} } ],
  "turbo": [ { "symbol":"TSLA","direction":"Short","rvol":"3.5","adv":2000000,
               "atr":"1.20","premarket_volume":200000,"gap_pct":"0.05",
               "above_vwap":false,"catalyst":true,"orb_confirmed":true,"momentum_ok":true } ],
  "marks": { "AAPL":"150.00","TSLA":"250.00" }     // symbol -> price (every candidate symbol)
}
```
**Rules:** Decimals as strings; `direction` ∈ {`Long`,`Short`}; `market`/symbols must match seeded `instruments`; every candidate symbol must have a mark; `bar_id` unique per frame (else the duplicate-bar gate fires). Storage = a **JSON list** (the format `load_fixtures` already requires).

## 3. Fixture Storage Location
- A versioned data file under the repo, e.g. `thul-nurayn/fixtures/paper_campaign_v1.json` (JSON list), referenced by `MARKET_DATA_FIXTURES`.
- **Inert data, not code.** May be split into per-segment files concatenated by a tiny manifest, but the loaded artifact is one JSON list (OR-2 authors data only; no loader change — `load_fixtures` already handles a JSON list).
- A companion `fixtures/README` documents provenance/determinism (synthetic, owner-authored; **not** live-vendor data).

## 4. Replay Sequencing
- Frames are consumed **in array order**, one per `TradingCycleWorker` tick (`provider.poll()`); `exhausted()` true at end.
- Sequencing encodes the **campaign timeline**: regime segments are contiguous blocks (e.g., Bull block → Bear/Sideways block → mixed), so the equity curve and regime coverage develop realistically.
- Entries and their corresponding **exits** are sequenced so positions open and later close within the dataset (closed trades are what D14 measures); paper fills are immediate at the supplied mark (P-SIZE/PaperTarget), so "exit" frames re-present the instrument with an exit mark that the campaign's close step records. *(Exact open→close representation is an implementation detail of the dataset; the architecture mandates that ≥200 positions reach CLOSED.)*

## 5. Time Handling
- `captured_at` is **ISO-8601 UTC**; the campaign's NY-session logic (D2) derives trading days via `America/New_York`.
- Frames advance monotonically; spacing must place trades across **≥30 distinct NY trading days** (span gate uses earliest→latest; D14 also counts active days).
- **Determinism via injected clock:** the entrypoint/provider accept a `clock`; for replay, `max_age_sec` is left unset (or generous) so historical `captured_at` values are **not** flagged stale. The dataset's timestamps are self-consistent; wall-clock is irrelevant to replay outcomes.
- No real-time waiting: cycles run as fast as the scheduler ticks; the timeline is **logical**, encoded in `captured_at`.

## 6. Market Regimes Represented
Regime is classified by D3 from `market_facts` (Bull: `spy_price > spy_sma_200 × 1.01`; Bear: `< × 0.99`; Sideways: within ±1%):
- **Bull segment:** `spy_price` clearly above SMA×1.01 (e.g., 500 vs 470).
- **Bear segment:** `spy_price` clearly below SMA×0.99 (e.g., 455 vs 470) — required for Turbo **Short** eligibility and ≥2-regime coverage.
- (Optional) **Sideways segment** within ±1% (emits no new trades — useful to exercise the no-trade path).
The orchestrator emits `scan` audit events carrying `regime`; **D14 derives ≥2-regime coverage from these events** (the gate is satisfied by Bull + Bear segments).

## 7. Long Coverage
- **Core (long-only, bull-gated):** Long candidates in the **Bull** segment with facts clearing D3 (RS ≥ 80, RVOL ≥ 1.5, `trend_stage2=true`, a qualifying breakout `base_days ≥ 50` or `new_52w_high`, optional PEAD ≤ 10d) → score into tradable bands.
- **Turbo Long:** Long candidates in **Bull** with RVOL ≥ 3.0, gap ≥ 4%, ATR ≥ $0.50, ADV ≥ 500k, `above_vwap=true`.
- Mix of winning and losing exits (via exit marks) so win-rate/profit-factor/drawdown are meaningfully exercised toward the policy.

## 8. Short Coverage
- **Turbo Short:** Short candidates in the **Bear** segment (Core is long-only, so Shorts come from Turbo) with RVOL ≥ 3.0, gap ≥ 4%, ATR ≥ $0.50, ADV ≥ 500k, `above_vwap=false` (below VWAP for shorts), catalyst/ORB/momentum as needed.
- Sufficient Short trades that reach CLOSED so `short_tested=true` and the direction-coverage gate passes; include winners and losers (Short PnL = (entry−exit)×qty).

## 9. Sector Coverage
- Candidate symbols span **multiple sectors** (seeded `instruments.sector_id`), so D14's sector breakdown is non-trivial and D4's sector-exposure context is exercised. *(D4 sector-exposure input is currently relayed at default per the P-ORCH limitation; sector variety still enriches D14 reporting.)*
- Recommend ≥ 4–6 distinct sectors across the symbol universe.

## 10. Minimum Data Required
| Dimension | Minimum |
|-----------|---------|
| Distinct NY trading days spanned | ≥ **30** |
| Closed paper trades produced | ≥ **200** |
| Market regimes observed (scan events) | ≥ **2** (Bull + Bear) |
| Long closed trades | ≥ 1 (materially more for stability) |
| Short closed trades | ≥ 1 (materially more for stability) |
| Distinct sectors | ≥ 4 (recommended) |
| Symbols seeded in `instruments` | every fixture symbol |
| Marks | one per candidate symbol per frame it appears |

> Frame count is dataset-design-dependent (multiple candidates per frame + open/close pairs); the binding requirements are **≥30 days, ≥200 closed trades, ≥2 regimes, both directions**.

## 11. Coverage Matrix (policy ↔ fixture mechanism)
| Policy gate | Satisfied by | Verified via |
|-------------|--------------|--------------|
| ≥ 30 trading days | timestamps spanning ≥30 NY dates | D14 `span_days` |
| ≥ 200 trades | ≥200 positions opened **and closed** in the dataset | D14 `trades` |
| ≥ 2 regimes | Bull + Bear `market_facts` segments | D14 `regimes_observed` (scan events) |
| Long tested | Core/Turbo Long candidates → closed | D14 `long_tested` / `by_direction` |
| Short tested | Turbo Short candidates (Bear) → closed | D14 `short_tested` / `by_direction` |
| Win rate / PF / DD / recovery / positive return | designed win/loss exit mix + drawdown-then-recovery arc | D14 metrics + gate |
| Integrity | clean frames (no fatal data-quality) on trading cycles | data-quality gate (no Reject) |

## 12. Determinism Guarantees
- **No randomness:** all values are fixed literals in the JSON; replay is a pure function of the file.
- **Order-stable:** array order = replay order; `bar_id` unique → no spurious duplicate-bar rejects.
- **Clock-independent:** outcomes depend only on `captured_at` values + fixed marks, not wall-clock (injected clock for tests; `max_age_sec` unset for replay).
- **Reproducible:** the same file ⇒ identical signals/scores/orders/fills/positions/PnL ⇒ identical D14 report and Pass/Fail. (Note: persisted IDs are UUIDs generated at runtime; *metrics and decisions* are deterministic even though row IDs vary.)
- **Self-consistent:** every candidate has a mark; every symbol maps to a seeded instrument; no fatal data-quality on intended trading frames.

## 13. Validation Methodology (how OR-2 proves itself)
1. **Schema check:** the file is a JSON list; each frame has the required keys; Decimals parse; directions valid; every candidate symbol has a mark.
2. **Seed alignment:** every fixture symbol exists in the seeded `instruments` (else the orchestrator skips it → trade shortfall).
3. **Dry replay (in-memory):** run the full campaign through the composed app on an **in-memory DAL** and compute the D14 cumulative report; assert the coverage matrix (§11) is met: `span_days ≥ 30`, `trades ≥ 200`, `len(regimes_observed) ≥ 2`, `long_tested and short_tested`.
4. **Gate dry-run:** `evaluate(report)` against the owner `ValidationThresholds` returns the **intended** outcome for a healthy dataset (and a deliberately-degraded variant returns FAIL) — proving the dataset can drive a PASS.
5. **Determinism check:** two independent replays yield identical metrics.
*(This validation is itself test/architecture work in the OR-2 build; no production component changes.)*

## 14. Definition of Done
1. A versioned JSON fixture dataset (`fixtures/…json`) in the exact `ReplayMarketDataProvider` format.
2. Bull **and** Bear regime segments (optional Sideways) → ≥2 regimes observed.
3. Long (Core+Turbo) **and** Short (Turbo/Bear) candidates that clear D3 thresholds and reach CLOSED.
4. ≥ 30 NY trading days spanned; ≥ 200 closed paper trades; ≥ 4 sectors; every symbol seeded.
5. Designed win/loss + drawdown→recovery arc capable of meeting the policy (or a documented, owner-tunable arc).
6. A companion **seed manifest** (instruments/sectors/operator user) consistent with the fixtures.
7. Validation methodology (§13) passes: in-memory dry replay meets the coverage matrix; gate dry-run reaches PASS; determinism holds.
8. No code/component/schema change (data + seed + validation only); reuse `ReplayMarketDataProvider`/`run.py` unchanged.
9. `OR2_FIXTURE_BUILD_REPORT.md` produced; stop at the gate.

## 15. Risks
| # | Risk | Severity | Mitigation |
|---|------|----------|------------|
| R1 | Dataset can't realistically hit ≥85% win-rate / PF≥2.0 without contrived exits | Medium | Owner-authored exit mix; the campaign measures honestly — a synthetic dataset proves the *pipeline*, not market edge (documented) |
| R2 | Symbol↔instrument seed drift (unseeded symbol ⇒ skipped ⇒ trade shortfall) | Medium | Seed manifest co-authored + validated (§13.2) |
| R3 | Volume/size: ≥200 trades × frames may be a large file | Low | Multiple candidates per frame; per-segment files; still one JSON list |
| R4 | Stale-data gate could reject historical `captured_at` | Low | Leave `max_age_sec` unset for replay (documented) |
| R5 | Sector-exposure / weekly-DD D4 inputs relayed at default (P-ORCH limitation) | Low (documented) | Sector variety still enriches D14; not a fixture defect |
| R6 | Determinism vs runtime UUIDs | Low | Metrics/decisions deterministic; row IDs vary (documented) |

## 16. Assumptions
1. **Synthetic, owner-authored data** — not live-vendor data; it validates the **pipeline and coverage**, not market predictive edge (P-VALIDATION already frames paper as pipeline validation).
2. **Fixtures are inert data** consumed by the unchanged `ReplayMarketDataProvider`; OR-2 authors data + seed + validation harness only.
3. **Open→close representation** within the dataset yields CLOSED positions (D14 measures closed trades); exact mechanism is a dataset-design detail.
4. **Seed data** (instruments/sectors/operator user) is provisioned consistently (overlaps P-DEPLOY/OR-3; the fixture defines what must be seeded).
5. **In-memory dry replay** is the OR-2 acceptance vehicle; the durable PostgreSQL campaign is OR-3.

## 17. GO Criteria for OR-2 Completion
OR-2 is **GO** when, on an in-memory dry replay of the authored dataset + seed:
- `span_days ≥ 30` **and** `trades ≥ 200` (closed) **and** `len(regimes_observed) ≥ 2` **and** `long_tested and short_tested`, **and**
- no fatal data-quality reject on intended trading frames, **and**
- two replays produce identical D14 metrics (determinism), **and**
- `evaluate(report)` against the owner policy can reach **PASS** for the healthy dataset (and FAILs for a degraded control), **and**
- the seed manifest matches every fixture symbol.
Then OR-3 (PostgreSQL provisioning) is the last blocker before the first durable campaign.

## 18. Stop Gate
**STOP.**

Architecture only — no fixtures authored, no code, no schema change, no component change. Await owner approval before implementing OR-2 (data + seed + validation harness). Do not begin OR-3 PostgreSQL provisioning, TradingView, IBKR, or Live Trading.
