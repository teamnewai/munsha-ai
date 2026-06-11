# EX1_PREREQUISITES_CHECKLIST

**Type:** Prerequisites checklist only. **No architecture. No implementation. No code. No additional reports.**
**Scope:** EX-1 = the **Exit Decision Engine** (the pure component that decides CLOSE/HOLD per the ratified philosophy). It does **not** include EX-2 (D5 close execution), EX-3 (target close), EX-4 (P-ORCH exit stage), or EX-5 (end-to-end).
**Goal:** Determine whether EX-1 can begin immediately with **provisional owner values**.

---

## 1. Decisions already CLOSED (ratified — no further input needed)

- [x] **Core philosophy** — structure/trend exit · winners run · no fixed profit target · hard-stop protection only.
- [x] **Turbo philosophy** — hard stop · break-even · trailing stop · mandatory session-close flatten.
- [x] **Full close only** (no partial closes).
- [x] **No partial profit-taking** (deferred to V2).
- [x] **Long/Short symmetry** (principle ratified; scope confirm = X-1 below).
- [x] **Gap-through-stop fills at actual market price.**
- [x] **Exits allowed during Kill-Switch L1–L3** (L4 halts all activity).
- [x] **Core structure triggers reuse existing boolean definitions** (`trend_stage2`, Bull-regime band `0.01`, breakout facts) — **no new number required.**
- [x] **Session-close is detectable from the existing `market_open` frame flag** — no new data source for detection.

## 2. Decisions still OPEN

**Non-numeric (selections / governance):**
- [ ] **X-4** — OP-3 in-v1 exception ruling (authorize building exits in v1 at all).
- [ ] **C-1** — which existing signal(s) define "Core thesis broken" (trend-stage break / regime flip / breakout failure / combination).
- [ ] **C-2** — Core hard-stop basis (**% confirmed**; ATR infeasible — `CoreCandidateInput` has no `atr`).
- [ ] **T-1** — Turbo hard-stop basis (% vs ATR-multiple).
- [ ] **T-4** — Turbo trailing-stop basis (% vs ATR-multiple).
- [ ] **C-3** — Core structure-exit **scope**: accept the marks-computable Core path now (regime-flip + % stop) **or** fund a per-cycle data path for trend-stage/breakout on open positions.
- [ ] **X-1** — confirm symmetry scope = full symmetry, no short-specific overrides (Turbo).
- [ ] **C-4** — Core hard-stop cadence (EOD/close-based vs intraday monitoring).
- [ ] **C-6** — Core win-rate gate posture (campaign-time governance).
- [ ] **X-2** — exit-state recovery scope (no-persist, replay-scoped vs persisted).
- [ ] **X-3** — persist risk basis for R-multiple? (optional).

**Numeric (provisional acceptable — see §4):**
- [ ] **V-1** Core hard-stop distance · **V-2** Turbo hard-stop · **V-3** Turbo BE trigger · **V-4** Turbo BE offset · **V-5** Turbo trailing · **V-6** Turbo session-close cutoff.

## 3. Which OPEN decisions are MANDATORY to begin EX-1

These shape the **engine logic** (not just its inputs), so EX-1 cannot start without them:

- [ ] **X-4** — governance authorization (without it, EX-1 contradicts the OP-3 freeze).
- [ ] **C-1** — defines the Core CLOSE condition (the logic shape).
- [ ] **C-2 = %** — confirm Core stop basis (logic computes from marks).
- [ ] **T-1, T-4** — Turbo stop/trail basis (% vs ATR changes what the engine computes).
- [ ] **C-3 scope** — must decide the **v1 Core path**: if "marks-computable path now" (regime-flip + % stop), EX-1 proceeds immediately and the data-path-dependent Core triggers are deferred; if "fund data path," EX-1's Core structure logic waits on that separate phase.
- [ ] **X-1** — confirm full symmetry (so the engine mirrors, not branches, for shorts).

## 4. Which OPEN decisions can safely use PROVISIONAL owner values

EX-1 is a **parameterized pure decision engine** — it takes the exit values as **injected configuration**, so its logic is value-agnostic. These may be provisional now and finalized before the campaign **without any code change**:

- [ ] **V-1 … V-6** — provisional **owner-supplied** values let EX-1 be built, run, and unit-exercised end-to-end. *(Must be owner-supplied, not invented; final Master-Spec values required before EX-5/OR-2 — not before EX-1.)*
- [ ] **C-6** — WR gate posture is campaign-time governance; not needed to build the engine.
- [ ] **X-2** — default provisionally to **no-persist, replay-scoped** (revisit for live).
- [ ] **X-3** — default provisionally to **no** (keeps no-schema); revisit later.
- [ ] **C-4** — default provisionally to **EOD/close-based** Core stop; revisit if intraday monitoring is funded.

## 5. Minimum set of VALUES required to begin EX-1

To **begin** EX-1 (build + run the parameterized engine), the minimum is:

1. **Governance + structural selections (must be final):** X-4, C-1, C-2 (=%), T-1, T-4, C-3 scope, X-1.
2. **Numeric values (provisional, owner-supplied):** V-1, V-2, V-3, V-4, V-5, V-6 — provisional bracket picks are sufficient to build/run; finals deferred to the campaign.
3. **Defaults accepted provisionally:** C-4 (EOD), X-2 (no-persist replay), X-3 (no).

**Not required to begin EX-1** (required later): final Master-Spec numeric values (before EX-5/OR-2); C-6 (before the campaign gate is judged); the C-3 data-path phase (only if the owner chose to fund full Core structure triggers).

## 6. Determination

**Can EX-1 begin immediately with provisional values? — YES, conditionally.**

EX-1 (the config-driven Exit Decision Engine) can start **now** **if** the seven §3 mandatory items are decided (six structural + X-4 governance) and the six numeric values are supplied **provisionally by the owner**. Because the engine treats V-1…V-6 as injected configuration, provisional values are sufficient to implement and exercise it; the **final Master-Spec values are not gating EX-1** — they gate the validation campaign (EX-5/OR-2).

**Two hard caveats:**
- Provisional values must be **owner-supplied**, never invented (freeze discipline).
- EX-1 output under provisional values proves the **engine works**, **not** that the strategy passes validation — no pass/fail meaning until final values + campaign.

If the owner prefers the simplest immediate start, the unblocking path is: **X-4 + C-1 + C-2(%) + T-1/T-4 bases + "C-3 = marks-computable Core path now" + X-1**, plus **provisional V-1…V-6**.

---

**STOP — checklist only. Awaiting owner decisions on the §3 mandatory items and provisional §5 values.** EX-1…EX-5 and OR-2 remain paused. No broker / TradingView / IBKR / live trading.
