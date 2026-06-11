# STRATEGY2_CORE_EXIT_ARCHITECTURE

**Type:** Pre-implementation architecture study for Strategy 2 (PROPOSED). **No code yet — awaiting approval (per requirement 6: "After approval: implement").**
**Scope:** Resolve Strategy Improvement Study **Finding F-B** (the Core profit exit is dormant ⇒ Core can only ever close at its hard stop, i.e. as a loss) for **Strategy 2 only**. **Strategy 1 is NOT modified.**
**Goal alignment:** optimize Profit Factor, net return, drawdown, and robustness — **not** 85%/100% win rate. Preserve: stop-loss protection · positive break-even offset · winners-run · PF-first.

---

## 1. Architecture study

### 1.1 The problem (source-verified)
`exit_decision.py:_evaluate_core` closes a Core position only on `hard_stop` OR `(trend_stage_break AND regime_flip)`. Under the marks-computable path the `trend_stage2` fact is never supplied for *open* positions (`Strategy2Orchestrator` passes `trend_stage2=None`), so the structure branch can never fire. Core also has **no break-even and no trailing**. ⇒ a Core position closes only at the hard stop (a loss) or never. Core, as wired, cannot book a profit. (F-B.)

### 1.2 The design — Strategy 2 Core Profit Exit (independent, marks/regime-computable)
Give Strategy 2's Core engine an **active profit-side exit ladder**, evaluated per cycle for each open Core position (Long-only; mirrored defensively). All inputs are available per cycle **without any new data source**:

| Rung | Rule | Source | Property preserved |
|---|---|---|---|
| **1. Hard stop (floor)** | CLOSE if `mark ≤ entry·(1−core_hard)` | mark | **stop-loss protection** |
| **2. Break-even (positive offset)** | once favorable move ≥ `core_be_trigger`, raise stop to `entry·(1+core_be_offset)` (a small **win**, not a scratch) | mark history | **positive break-even offset** |
| **3. Trailing stop** | after arming, trail the high-water by `core_trailing`; CLOSE on retrace to the trail | mark history | **winners-run / PF-first** (wide trail ⇒ large average winner) |
| **4. Regime-flip thesis exit** | Core is Bull-gated; if the regime turns non-Bull, CLOSE (thesis broken) | `MarketRegimeEngine.evaluate(frame.market_facts)` — pure, read-only | the marks/regime-computable half of the F-B structure exit |
| **5. HOLD** | otherwise — winner runs | — | **winners-run** |

Effective stop once armed = `max(hard, break-even, trail)`; CLOSE if breached **or** regime flips. (No session-flatten for Core — it is a swing/EOD engine.)

**Why this resolves F-B fully and robustly:** Core now banks trend profits (rung 3) and exits on a genuine thesis break (rung 4) while keeping a hard floor (rung 1) and converting defended trades to small wins (rung 2). It is **PF-first** (let winners run via a wide trail) and needs **no new data path**.

### 1.3 The one deliberately-deferred piece (transparency)
The original C-1 `trend_stage2` structure component (per-instrument SMA stack for *open* positions) still requires a per-cycle data path that the transient frame does not carry. It is **not needed** for a production-ready Core profit exit — rungs 3–4 already provide a robust, profit-booking, winners-run thesis exit. The full `trend_stage2` structure exit is recorded as a **future, separately-approved enhancement** (it would be a shared P-DATA/frame change — see §6).

---

## 2. Dependency map

```
FROZEN shared (READ-ONLY reuse — not modified):
  D1 models (Position, …) ─┐
  D3 MarketRegimeEngine.evaluate(market_facts)  ──(pure regime)──┐
  D6 PnLCalculator / PortfolioState.close_position ──────────────┤
  D5 ExecutionEngine via PaperTarget.handle_close (EX-2/EX-3) ───┤
  EX-1 ExitDecisionEngine (Turbo eval + advance_state) ──(COMPOSITION)──┐
                                                                        ▼
NEW (Strategy 2 package only):
  strategy2/exit_engine.py : Strategy2ExitConfig + Strategy2ExitEngine
        ├─ Core  -> the rung-1..5 ladder (new, marks/regime-computable)
        └─ Turbo -> delegates to a composed EX-1 ExitDecisionEngine (reuse)
                                                                        ▼
  strategy2/orchestrator.py (Strategy 2's own file):
        exit stage computes regime from frame.market_facts (read-only) and
        passes regime_is_bull into the Core exit context; uses Strategy2ExitEngine
                                                                        ▼
  comparison campaign runner ──► D14 compute_validation_metrics / gate (read-only)

Strategy 1 (baseline orchestrator, EX-1, shared domain): UNTOUCHED.
```

---

## 3. Implementation plan (executed only after approval)

1. **`strategy2/exit_engine.py` (new):** `Strategy2ExitConfig` (Core: `core_hard_stop_pct`, `core_be_trigger_pct`, `core_be_offset_pct`, `core_trailing_pct`; Turbo: existing five params) + `Strategy2ExitEngine` (Core ladder §1.2; Turbo delegated to an internally-composed `ExitDecisionEngine` built from the Turbo params — reuse, no modification; `advance_state` reused for high-water/BE latch).
2. **`strategy2/config.py` (Strategy-2 file):** replace `proposed_exit_config()` to return the `Strategy2ExitConfig` with provisional sound-approach values (tighter Core hard stop, earlier Core BE, positive Core offset, wide Core trail). Values illustrative; finals from Master Spec/owner.
3. **`strategy2/orchestrator.py` (Strategy-2 file):** in `_run_exits`, compute `regime = MarketRegimeEngine().evaluate(frame.market_facts)` when facts are present and pass `regime_is_bull=(regime is BULL)` into the Core `ExitEvaluationContext`; construct `Strategy2ExitEngine`. (Turbo path unchanged.)
4. **`strategy2/__init__.py`:** export the new engine/config.
5. **Comparison fixture:** extend the deterministic campaign fixture to **include Core (swing/Bull/Long) days with forward marks** so the Core trailing/regime exit is actually exercised (the current OR-2 fixture is Turbo-only, so it would not show F-B's effect). Keep it deterministic; both strategies run the **same** fixture.
6. **Tests:** `tests/test_strategy2_core_exit.py` — Core books a trailing win; Core exits on regime flip; Core hard stop still protects; positive-BE converts a scratch to a win; Strategy 1 still cannot (unchanged).
7. **Validation + PostgreSQL campaigns:** run Strategy 1 and Strategy 2 on the **same** Core-inclusive fixture against PostgreSQL (isolated runs), compute D14 metrics for each, and produce the comparison report.

---

## 4. Affected files

| File | Change | Layer |
|---|---|---|
| `src/app/strategy2/exit_engine.py` | **NEW** | Strategy 2 |
| `src/app/strategy2/config.py` | modify (own file) | Strategy 2 |
| `src/app/strategy2/orchestrator.py` | modify (own file) | Strategy 2 |
| `src/app/strategy2/__init__.py` | modify (exports) | Strategy 2 |
| `src/app/marketdata/campaign_fixture.py` *(or a new strategy-neutral comparison fixture)* | add Core days | shared fixture (additive; used by both strategies equally — **not** strategy logic) |
| `tests/test_strategy2_core_exit.py` | **NEW** | tests |
| `tests/test_strategy_comparison.py` | **NEW** (the A/B run) | tests |
| **Strategy 1 / EX-1 / D1–D6 / schema** | **NONE** | frozen |

---

## 5. Shared-layer change assessment (requirement 2)

**No frozen shared-domain modification is required.**
- EX-1 `ExitDecisionEngine` is reused by **composition** (calling its public `evaluate`/`advance_state`) for Turbo — **not edited**.
- `MarketRegimeEngine.evaluate` and `PnLCalculator` are called **read-only** — **not edited**.
- `ExitState` / `ExitEvaluationContext` are reused as neutral value objects — **not edited**.
- **No schema change.** Core exit-state is re-derivable from marks (same no-persist, replay-scoped basis as EX-1).
- The comparison **fixture** is test/replay data (additive, strategy-neutral), not domain logic.

**If — and only if — the full `trend_stage2` structure exit is later desired**, that requires extending the P-DATA frame to carry per-cycle trend facts for *open* positions (a shared P-DATA change). That is **out of this scope**, flagged here, and would be brought back for **separate identification/justification/approval** before any such change. This study does **not** request it.

---

## 6. Expected impact (directional; vs Strategy 1 on the same Core-inclusive fixture)

| Metric | Expected direction | Mechanism |
|---|---|---|
| **Profit Factor** | **▲▲** | Core can now book trend winners (wide trail) instead of only losing at the hard stop ⇒ large average winner, bounded losses. |
| **Net Return** | **▲▲** | Core converts from loss-only to profit-contributing. |
| **Win Rate** | **▲ (modest)** | positive break-even offset turns defended scratches into small wins; the existing S2 quality gate raises signal quality. *(Not optimized toward 85%/100%.)* |
| **Max Drawdown** | **▼ / controlled** | tighter Core hard stop + break-even bound per-trade loss; mild give-back from trailing is the only widening factor. |
| **Recovery / Robustness** | **▲** | Core no longer structurally loss-only ⇒ healthier equity curve and recovery profile. |

**Honest caveat:** these are directional expectations; the **comparison campaign produces the real numbers** (§3.7). On a Turbo-only fixture F-B shows ~no effect, which is exactly why §3.5 adds Core days so the test is meaningful.

---

## 7. Definition of Done (for the eventual implementation)

Strategy 2 is production-ready when: Core books profits via the trailing/regime ladder while preserving the hard stop and positive break-even; winners-run and PF-first are intact; no shared-domain/schema change; full suite green; and a PostgreSQL A/B campaign (Strategy 1 vs Strategy 2 on the identical Core-inclusive fixture) yields the comparison report (Return, PF, WR, Max DD, Recovery, #Trades, Avg Winner, Avg Loser, sector breakdown, Long/Short breakdown).

---

## 8. Stop gate

**STOP — architecture study only. Awaiting your approval before any coding** (per requirement 6). No code, no shared-layer change, no Strategy 1 change. On approval I will implement §3, run full validation, run the PostgreSQL A/B campaign, and deliver the final comparison report.
