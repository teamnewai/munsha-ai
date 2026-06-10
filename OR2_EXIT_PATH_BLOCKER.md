# OR2_EXIT_PATH_BLOCKER

**Type:** Blocker finding discovered during OR-2 implementation. **No code authored. No strategy/execution/schema change.**
**Status:** OR-2 **paused** — a structural prerequisite is missing; owner decision required before fixtures are authored.
**Verified from source** (not assumed): greps over `src/app/orchestrator.py`, `src/app/targets/paper.py`, `src/app/run.py`, `src/app/validation/metrics.py`.

---

## 1. The Finding
The autonomous paper pipeline **opens positions but never closes them**, while validation **measures closed positions**. Therefore an autonomous replay cannot produce the closed-trade metrics the Owner Validation Policy requires.

## 2. Evidence (source-verified)
- **PaperTarget** creates positions with `status=PositionStatus.OPEN` (`src/app/targets/paper.py:87`); it returns an OPEN position and never transitions it.
- **P-ORCH / run** have **no close/exit path**: grep for `close_position | PositionStatus.CLOSED | exit_price | closed_at | transition…CLOSED` in `orchestrator.py` / `paper.py` / `run.py` → **NONE**. (`recovery.py:96` `state.close_position(pos)` only replays *already-closed* DB rows into `PortfolioState` during B9 recovery — it does not close live positions.)
- **D14 measures CLOSED positions:** `metrics.py:_closed_sorted` → `dal.positions.list(status=PositionStatus.CLOSED)`; all policy metrics (trades, win rate, profit factor, drawdown, recovery, portfolio return) derive from **closed** positions.
- **Policy definition:** P-VALIDATION §4 — "Trades = closed paper positions (completed round-trips)."

⇒ A replay run yields OPEN positions only ⇒ **0 closed trades** ⇒ `trades=0`, `win_rate=0`, `profit_factor=None`, `portfolio_return=0` ⇒ the policy gates (≥200 trades, ≥85% WR, PF≥2.0, MaxDD≤10%, recovery, positive return) **cannot be evaluated or satisfied**.

## 3. Why This Is Not an OR-2 (Fixture) Problem
Fixtures feed **candidates** (which the pipeline turns into OPEN positions). There is **no fixture field or ingestion path that closes a position** — the pipeline has no exit step to invoke. No dataset, however large, can produce closed trades through the current pipeline. Authoring a ≥200-"trade" fixture now would yield 200 **open** positions and **0 closed trades** — a misleading deliverable that cannot meet OR-2's GO criteria.

## 4. Root Cause
**Position exit/close is unimplemented.** Per `OWNER_PROFIT_POLICY`, exits are governed by "trailing-stop and the approved exit methodology" — but that methodology is **frozen strategy/execution** and **no code implements position exits**. The pipeline was built (correctly, per scope) as entry-and-open; the **exit/close leg was never an authorized build phase**.

Adding an exit/close path is **execution logic** → explicitly **outside OR-2's constraints** ("no execution changes," "no strategy changes") and the v1 freeze. I will **not** add it under OR-2.

## 5. Impact
- **OR-2 GO criteria unreachable** as written (≥200 closed trades, win-rate, PF, DD, recovery).
- **The entire first paper-validation campaign** cannot produce its metrics until positions can close.
- Everything else built (D1–D14, P-SIZE, P-DATA, P-ORCH, OR-1) is correct and unaffected; this is a **missing capability**, not a defect in delivered work.

## 6. Owner Decision Required (options)
| # | Option | Nature | Notes |
|---|--------|--------|-------|
| **A** | Authorize a new **Exit/Close phase** (architecture-first) implementing the approved exit methodology (trailing-stop / approved exits) for the Paper target | **Execution logic** → formal architecture review + versioned approval (touches the freeze) | Most faithful; enables real closed trades + realized PnL; then OR-2 fixtures can drive a true campaign |
| **B** | Define a **deterministic paper-only exit construct** for replay validation (e.g., fixtures carry explicit exit instructions / time-based or target-based close used **only** by the Paper/replay path) | New close path scoped to paper validation | Smaller, but still adds a close path → needs architecture review; must not leak into live execution rules |
| **C** | **Redefine validation** to measure open-position mark-to-market instead of closed trades | Changes approved D14 + P-VALIDATION + the policy's "closed round-trips" definition | Least desirable; alters governance and the meaning of "trade" |

**Recommendation:** **Option A** — authorize an *Exit/Close architecture* (review-gated) before OR-2 fixtures, so the campaign measures real closed round-trips per the policy. (Option B is acceptable as a *paper-only* validation construct if the owner wants a faster path, but still requires architecture review and explicit scoping to avoid touching live execution rules.) **Do not** author fixtures until the close path exists, to avoid a dataset that cannot meet the policy.

## 7. What I Did / Did Not Do
- **Did:** verify the gap from source; pause OR-2; document the finding + options. No files changed except this report.
- **Did NOT:** author fixtures, add any exit/close/strategy/execution code, modify D14/policy, or change any frozen layer.

## 8. Stop Gate
**STOP.**

OR-2 is paused pending an owner decision on the missing exit/close path (§6). No code, no fixtures, no strategy/execution/schema change. Do not begin OR-3, TradingView, IBKR, or Live Trading. Awaiting owner direction.
