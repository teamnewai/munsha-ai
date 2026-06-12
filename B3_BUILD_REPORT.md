# B3_BUILD_REPORT

**Phase executed:** B3 — Selection Engine.
**Authorization:** B1 + B2 approved; B3 explicitly authorized.
**Followed:** Master Specification (§3 Scanner, §4 Regime, §8 Score, §9–11 Classification, §12–13 Long/Short) · D3_SELECTION_REPORT · D1 Foundation · D2 Data Access Layer.
**Result:** ✅ Complete. **100/100 tests pass** (37 D1 + 30 D2 + 33 B3), 100% offline.
**Boundary honored:** pure, deterministic selection only — **no** risk, sizing, portfolio, execution, broker, API, or UI logic; no I/O; no D2 access; D1/D2 unmodified.

---

## 1. Files Created

| File | Purpose |
|------|---------|
| `thul-nurayn/src/selection/__init__.py` | package exports |
| `thul-nurayn/src/selection/constants.py` | all thresholds + weights, transcribed from the Master Spec (single source) |
| `thul-nurayn/src/selection/facts.py` | input facts (`MarketFacts`, `CoreCandidateInput`, `TurboCandidateInput`, `BreakoutFacts`, `EarningsFacts`) + output `ScoredCandidate` |
| `thul-nurayn/src/selection/regime.py` | `MarketRegimeEngine` (regime + direction gate) |
| `thul-nurayn/src/selection/components.py` | `RelativeStrengthEngine`, `BreakoutDetectionEngine`, `RVOLEngine`, `PEADIntegrationLayer` |
| `thul-nurayn/src/selection/scanners.py` | `CoreScanner`, `TurboScanner` |
| `thul-nurayn/src/selection/ranking.py` | `RankingEngine`, `TradeClassificationEngine`, `classify_score` |
| `thul-nurayn/src/selection/engine.py` | `SelectionEngine` orchestrator + `SelectionResult` |
| `thul-nurayn/tests/test_selection.py` | B3 unit tests |

No files were created under any other module; **D1 and D2 were not modified** (no bug found).

---

## 2. Tests Added

**33 B3 tests** in `tests/test_selection.py`:

| Group | Tests | Focus |
|-------|-------|-------|
| `TestRegime` | 4 | Bull/Bear/Sideways (±1% band); direction gate |
| `TestCoreScoring` | 5 | 100/UltraGolden; 90/Strong (no PEAD anchor); 95.5/Golden; 73.5/Watchlist; base<50d dropped |
| `TestCoreGates` | 7 | RS<80, RVOL<1.5, no trend, no breakout, low ADV, Long-in-Bear, Short-core dropped |
| `TestTurboScoring` | 4 | 100; 94/Strong (no catalyst); 65/Watchlist; valid Short in Bear |
| `TestTurboGates` | 8 | ATR<0.5, low ADV, low premarket, RVOL<3, gap<4%, Long-below-VWAP, Short-above-VWAP, Short-in-Bull |
| `TestClassification` | 1 | band edges (100/95/99/94/90/89.9) |
| `TestRankingAndEngine` | 4 | rank desc + symbol tie-break; `run()`; determinism; Sideways emits nothing |

---

## 3. Total Test Count

```
Ran 100 tests in ~0.008s
OK
```
D1: 37 · D2: 30 · **B3: 33** · Total **100**, all green.

---

## 4. Coverage of D3 Requirements

| D3 component (report §2) | Implemented | Verified |
|--------------------------|-------------|----------|
| 1. Market Regime Engine | `regime.py` | ✅ Bull/Bear/Sideways + gate |
| 2. Core Scanner | `scanners.CoreScanner` | ✅ gates + scoring |
| 3. Turbo Scanner | `scanners.TurboScanner` | ✅ gates + scoring |
| 4. Relative Strength Engine | `components.RelativeStrengthEngine` | ✅ 80 gate / 90 boost |
| 5. Breakout Detection Engine | `components.BreakoutDetectionEngine` | ✅ 52w / base ≥50d |
| 6. RVOL Engine | `components.RVOLEngine` | ✅ Core 1.5/2.0 · Turbo 3.0 |
| 7. PEAD Integration Layer | `components.PEADIntegrationLayer` | ✅ ≤10d + aligned, complementary |
| 8. Ranking Engine | `ranking.RankingEngine` | ✅ desc + tie-break |
| 9. Trade Classification Engine | `ranking.classify_score` | ✅ Ultra/Golden/Strong/Watchlist |

**Interfaces (D3 §4):** inputs `MarketFacts · CoreCandidateInput · TurboCandidateInput · BreakoutFacts · EarningsFacts`; output `ScoredCandidate(symbol, engine, direction, score, classification, breakdown)`; all thresholds centralized in `constants.py` (sourced from spec). **Properties (D3 §3):** deterministic, pure, stateless; Core & Turbo independent (engine tag, A.7); consumes passed-in facts — does **not** compute indicators/prices. Threshold anchors verified: RS 80/90 · RVOL 1.5/2.0/3.0 · Gap 4% · ATR 0.5 · ADV 500k · Premkt 100k · PEAD ≤10d · bands 90/95/100.

> The pack's D3 report cited 19 unit tests; this build provides **33** (a superset).

---

## 5. Assumptions Made

1. **Intra-component grading curve** — the Master Spec gives thresholds and §8 weights but not a grading curve. Modeled as: §3 rules are **eligibility gates** (fail → candidate dropped); §8 components are **scored**; two-tier components award full weight at the boost level and `BASE_AWARD_FRACTION = 0.7 × weight` at the minimum threshold. **PEAD is the only non-gate** (complementary). This reproduces the D3 report's anchor exactly: **all-but-PEAD ⇒ 90 (Strong)**, all ⇒ 100 (UltraGolden).
2. **Core is Long-only** (Master §12); **Short is a Turbo construct** (Master §13). Core Short candidates are dropped.
3. **Sideways ⇒ no new candidates emitted** (Master §4 "تقليص النشاط" modeled as no-trade for emission).
4. **Regime & Trend are full-weight for any emitted Core candidate** (they are eligibility gates); score variation comes from RS/Breakout/RVOL tiers and PEAD presence (Core), and from Gap-Catalyst/ORB/Momentum (Turbo).
5. **Turbo RVOL & VWAP-bias award full weight at threshold** (no higher tier specified in spec).
6. **Facts are passed in** (RS rating, RVOL, gap, ATR, VWAP side, ORB, momentum, trend-stage2, breakout, earnings). D3 does not compute them; a data provider supplies them in a later phase (matches D3 report §4/§8).
7. **No persistence in B3.** D3 is side-effect-free (D3 report §3), so it does not write `signals`/`scores` via D2; that wiring belongs to a later phase. Hence B3 does not import D2 — it reuses only D1 enums.
8. **`Decimal` scoring** throughout for deterministic, exact band edges.

All assumptions are confined to the unspecified scoring curve and emission policy; **no spec threshold, weight, or rule was invented or changed.**

---

## Definition of Done

| Item | Status |
|------|--------|
| Scanner architecture (regime → scanners → ranking → classification) | ✅ |
| Core & Turbo workflows | ✅ |
| RS / Breakout / RVOL / PEAD components | ✅ |
| Ranking & classification | ✅ |
| Deterministic, pure, offline; no D2 access | ✅ |
| Reuses D1 enums; D1/D2 unmodified | ✅ |
| No risk/execution/portfolio/broker/API logic | ✅ |
| Unit tests green | ✅ 33 (full suite 100) |
| Build report | ✅ (this file) |

---

## B3 GATE

**B3 is COMPLETE.** Stopping at the B3 review gate.
**B4 (Risk Gate) has NOT been started** and will not begin without owner review/approval.

**STOP — awaiting review.**
