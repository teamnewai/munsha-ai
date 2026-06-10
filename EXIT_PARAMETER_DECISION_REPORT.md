# EXIT_PARAMETER_DECISION_REPORT

**Type:** Decision report. **No implementation. No code. No architecture change. No schema change.**
**Status:** **DRAFT — awaiting owner decisions.** Follows approval of `EXIT_CLOSE_ARCHITECTURE.md` (commit `7592167`).
**Purpose:** Enumerate every missing strategy parameter required to implement the approved exit methodology, so the owner can decide each one *before* EX-1 begins. Recommendations are provided as requested, but **every recommended value is provisional and subordinate to the owner-held Master Specification** — if the Master Spec states a value, that value wins and this report's recommendation is discarded.

**Grounding (source-verified, not assumed):**
- Per-cycle pipeline input carries **`marks: dict[symbol→Decimal]`** (price) and a `QualityReport` (`marketdata/frame.py:54`). `ATR` exists only on **candidate** inputs at scan time (`marketdata/replay.py:80`), **not** guaranteed per-cycle for an already-open position.
- Realized PnL = Long `(exit−entry)·qty` / Short `(entry−exit)·qty` (`portfolio/calculators.py:29-42`).
- Kill-switch ladder constants: new trades blocked at **L2+** (`risk/constants.py:19-20`); D4 `KillSwitchGate` gates *entries* (`risk/gates.py:23-33`).
- Existing risk limits (for consistency reference): MAX_OPEN=5, MAX_TRADES/DAY=5, DAILY_DD=−3%, WEEKLY_DD=−6%, CONSEC_LOSS=3, SECTOR=25% (`risk/constants.py:12-17`).
- Position model has `entry_price`, `exit_price`, `closed_at`, immutable `direction` (`models/__init__.py:165-175`); `OPEN→CLOSED` is the only legal position transition (`execution/state_machines.py:43-46`).

**Cross-cutting feasibility constraint (drives several recommendations):** For an **open** position, the only per-cycle market input guaranteed today is its **price mark**. ATR/volatility for a *held* symbol is **not** in the per-cycle frame unless that symbol is also re-scanned as a candidate. Therefore any **ATR-based trail would require a new data path** (a schema/data-architecture change to carry per-cycle ATR for open positions), whereas a **percentage-based trail is computable from marks alone** with no new data. This is recorded under each affected parameter and as global Risk G-1.

---

## How to read each entry
Name · Purpose · Where used · Required owner decision · Alternatives · Pros · Cons · **Recommended (provisional, Master-Spec-overridable)**.

---

## P-1. Core trailing-stop **type**
- **Purpose:** Defines *how* the Core (Swing) trail distance is measured.
- **Where used:** Exit Decision Engine (EX-1), evaluated per open Core position per cycle (§3 of architecture).
- **Required owner decision:** Which measurement basis governs the Core trail.
- **Alternatives:**
  - **(a) Percentage of price** (e.g., trail = X% below the high-water mark for longs).
  - **(b) ATR-multiple** (trail = k × ATR below high-water).
  - **(c) Fixed dollar amount.**
- **Pros / Cons:**
  - (a) Pros: computable from `marks` alone (no new data path); deterministic; simple to audit. Cons: not volatility-adaptive.
  - (b) Pros: volatility-adaptive (classic swing approach). Cons: **requires per-cycle ATR for open positions, which the current frame does not provide** → needs a data-architecture/schema change (G-1); harder to make deterministic for replay.
  - (c) Pros: trivial. Cons: ignores instrument price scale; poor across a multi-symbol universe.
- **Recommended:** **(a) Percentage of price** for v1 — it is the only option implementable with **zero data/schema change** and is fully deterministic for the replay campaign. If the Master Spec mandates ATR, escalate to a data-path phase first (G-1). *Provisional — Master Spec overrides.*

## P-2. Core trailing-stop **value**
- **Purpose:** The numeric trail distance for Core.
- **Where used:** Exit Decision Engine (EX-1); the threshold that fires `CLOSE`.
- **Required owner decision:** The exact value (and units, tied to P-1).
- **Alternatives:** Any specific value, e.g. **8% / 10% / 12%** (if P-1=percentage), or **2.5×/3× ATR** (if P-1=ATR).
- **Pros / Cons:** Tighter (e.g., 8%) → protects profit sooner, more exits, risks cutting winners early (tension with "winners run"). Wider (e.g., 12%) → lets winners run longer, gives back more on reversal.
- **Recommended:** **No invented number.** This is a pure strategy value that **must come from the Master Spec.** If the Master Spec is silent, the owner must set it explicitly; the report will not fabricate a Core trail percentage. *(Placeholder for discussion only, not a recommendation: a 10% swing trail is a common reference point — but it must be owner-set.)*

## P-3. Core **arming condition**
- **Purpose:** Defines *when* the trail becomes active after entry (immediately, or only after the position moves favorably by some amount).
- **Where used:** Exit Decision Engine (EX-1) high-water/derivation logic (§5).
- **Required owner decision:** Whether the trail arms at entry or after a trigger.
- **Alternatives:**
  - **(a) Arm immediately at entry** (high-water starts at entry price).
  - **(b) Arm after a profit threshold** (trail engages only once unrealized gain ≥ T).
  - **(c) Arm after a hard-stop is cleared** (initial fixed stop until breakeven, then trail).
- **Pros / Cons:** (a) simplest/deterministic, but trail can fire near entry on normal noise. (b) lets the trade "breathe" early; needs a second number (T). (c) couples to the hard-stop (P-4); most "professional" but most parameters.
- **Recommended:** **(a) Arm immediately**, *paired with a hard-stop (P-4)* for downside — fewest parameters, fully deterministic, no profit-target coupling (respects `OWNER_PROFIT_POLICY`). Revisit (b)/(c) only if the Master Spec specifies a breathing threshold. *Provisional.*

## P-4. Core **hard-stop policy**
- **Purpose:** A fixed initial protective stop (max loss) independent of the trail, bounding downside before the trail arms/advances.
- **Where used:** Exit Decision Engine (EX-1) — a `CLOSE` if mark breaches the hard-stop.
- **Required owner decision:** Whether a hard-stop exists, and its value.
- **Alternatives:**
  - **(a) Hard-stop = fixed % below entry** (e.g., −X%).
  - **(b) No hard-stop; trail is the sole exit.**
  - **(c) Hard-stop = ATR-multiple** (data-path constrained, G-1).
- **Pros / Cons:** (a) bounds worst-case loss per trade; deterministic; supports a tighter, validatable max-drawdown story (the campaign gate is MaxDD ≤ 10%). (b) simplest but a fast adverse move before the trail engages is uncapped at the trade level. (c) volatility-aware but needs ATR data path.
- **Recommended:** **(a) A fixed-% hard-stop**, value from the Master Spec. A defined max loss per trade materially helps the campaign's MaxDD ≤ 10% gate and is consistent with a disciplined risk posture. **Value must be owner/Master-Spec-set** (no fabricated number). *Provisional on existence = yes; value = Master Spec.*

## P-5. Turbo trailing-stop **type**
- **Purpose:** Measurement basis for the Turbo (Intraday) trail.
- **Where used:** Exit Decision Engine (EX-1), per open Turbo position per cycle.
- **Required owner decision:** Measurement basis for Turbo.
- **Alternatives:** Same set as P-1 (percentage / ATR-multiple / fixed-dollar).
- **Pros / Cons:** Intraday moves are smaller and faster, so a percentage trail for Turbo is typically **tighter** than Core. ATR-multiple is the more "correct" intraday basis but is **data-path constrained** (G-1).
- **Recommended:** **Percentage of price** for v1 (same zero-data-change rationale as P-1), with a Turbo-specific (tighter) value. *Provisional — Master Spec overrides.*

## P-6. Turbo trailing-stop **value**
- **Purpose:** Numeric trail distance for Turbo.
- **Where used:** Exit Decision Engine (EX-1).
- **Required owner decision:** Exact Turbo value/units.
- **Alternatives:** A specific (tighter) value, e.g. **2% / 3% / 5%** if percentage-based.
- **Pros / Cons:** Tighter → captures intraday scalps, exits fast, more whipsaw. Wider → fewer exits but Turbo positions may bleed into give-back.
- **Recommended:** **No invented number — Master Spec.** Turbo trail should be **tighter than Core** (P-2) by design, but the value is strategy and must be owner-set. *(Placeholder, not a recommendation: Turbo trails are commonly a fraction of the swing trail.)*

## P-7. Turbo **arming condition**
- **Purpose:** When the Turbo trail activates after entry.
- **Where used:** Exit Decision Engine (EX-1).
- **Required owner decision:** Arm-at-entry vs arm-after-threshold for Turbo.
- **Alternatives:** Same as P-3 (a/b/c).
- **Pros / Cons:** Intraday positions have little time to "breathe," so a profit-threshold arm (b) can leave very little runway; immediate arm (a) is the most common intraday default.
- **Recommended:** **(a) Arm immediately at entry**, paired with the Turbo hard-stop (P-8). *Provisional.*

## P-8. Turbo **hard-stop policy**
- **Purpose:** Fixed initial protective stop for Turbo.
- **Where used:** Exit Decision Engine (EX-1).
- **Required owner decision:** Exists? Value? (Turbo-specific, typically tighter than Core P-4.)
- **Alternatives:** Same as P-4 (fixed-% / none / ATR).
- **Pros / Cons:** Intraday risk control usually warrants a **tighter** hard-stop than swing. No hard-stop on a fast intraday reversal is the riskiest single-trade exposure.
- **Recommended:** **Fixed-% hard-stop, tighter than Core**, value from Master Spec. *Provisional on existence = yes.*

## P-9. Turbo **session-close policy**
- **Purpose:** Whether/ how Turbo Intraday positions are force-flattened at the trading session's end (no overnight hold).
- **Where used:** Exit Decision Engine (EX-1) — a forced `CLOSE` at/near session close; requires P-ORCH to know session boundaries (EX-4).
- **Required owner decision:** Does Turbo go flat at session close? If so, at what cutoff, and at what price reference?
- **Alternatives:**
  - **(a) Force-flat all Turbo positions at session close** (definition of "intraday").
  - **(b) Allow Turbo to hold overnight** (then it is not strictly intraday).
  - **(c) Force-flat at a defined pre-close cutoff** (e.g., N minutes before close).
- **Pros / Cons:** (a) true to "Intraday," caps overnight gap risk; needs reliable session-boundary data and a defined close mark. (b) contradicts the engine's name and adds gap risk. (c) avoids illiquid closing auction but adds a cutoff parameter.
- **Recommended:** **(a) Force-flat at session close** (it is what "Intraday" means), using the last valid mark of the session as the exit reference; confirm the exact cutoff from the Master Spec. **Note:** v1's replay/data layer must expose a session-close signal for this to be implementable deterministically — flag as an EX-4 + OR-2 data input requirement. *Provisional, pending Master Spec cutoff.*

## P-10. Kill-switch **interaction with exits**
- **Purpose:** Define whether the kill-switch (which blocks *entries* at L2+) also blocks *exits*.
- **Where used:** P-ORCH exit stage (EX-4); reads `kill_switch_cache.current_level()`.
- **Required owner decision:** At which kill-switch levels are exits permitted vs halted?
- **Alternatives:**
  - **(a) Exits permitted at L1–L3; only L4 halts exits** (asymmetric: exits reduce risk).
  - **(b) Exits follow the same gate as entries (blocked at L2+).**
  - **(c) Exits always permitted, even at L4.**
- **Pros / Cons:** (a) lets the system protect/reduce risk during stress while stopping new exposure — the intuitive, safe behavior; matches the architecture's R-3/OD-E1. (b) **dangerous** — would trap open positions during a drawdown precisely when closing matters most. (c) overrides the emergency-shutdown intent of L4 (which means "stop all activity").
- **Recommended:** **(a) Exits permitted at L1–L3; L4 halts all activity** (entries *and* exits), because L4 is a hard emergency stop. This is the asymmetry already proposed as architecture OD-E1. *Strongly recommended.*

## P-11. Exit-evaluation **frequency**
- **Purpose:** How often each open position is evaluated for exit.
- **Where used:** P-ORCH exit stage (EX-4), driven by the `TradingCycleWorker` interval (`orchestrator.py:295-306`).
- **Required owner decision:** Evaluate exits every cycle, or on a different cadence?
- **Alternatives:**
  - **(a) Every trading cycle** (same cadence as scan/score; one tick = evaluate all open positions).
  - **(b) A separate, faster exit cadence** (exits checked more often than entries).
  - **(c) Event-driven** (only on new mark).
- **Pros / Cons:** (a) simplest, reuses the existing worker tick, deterministic for replay; exit latency = cycle interval. (b) tighter exit control but adds a second scheduler path and complexity. (c) ideal in live but ill-defined for v1's frame-poll replay.
- **Recommended:** **(a) Every trading cycle** — reuses the existing P-ORCH cadence with no new scheduler, deterministic for the replay campaign. Exit latency is bounded by `TRADING_CYCLE_INTERVAL_SEC`; the owner sets that interval to match the engines' timeframe. *Recommended.*

## P-12. Long vs Short **symmetry**
- **Purpose:** Whether trail/hard-stop/arming behave as exact mirrors for shorts vs longs, or differ.
- **Where used:** Exit Decision Engine (EX-1) direction-aware logic; PnL already mirrors (`calculators.py:40-42`).
- **Required owner decision:** Are short exits the exact mirror of long exits (same values, reflected), or do shorts use different parameters?
- **Alternatives:**
  - **(a) Full symmetry** — short trail/stop = long values, mirrored (long trails the high-water below; short trails the low-water above).
  - **(b) Asymmetric** — shorts use distinct values (e.g., tighter, reflecting borrow/squeeze risk).
- **Pros / Cons:** (a) fewest parameters, simplest to reason about and audit, matches the symmetric PnL design. (b) more faithful to real short-side risk (squeezes are violent) but doubles the parameter set and the validation surface.
- **Recommended:** **(a) Full symmetry for v1** unless the Master Spec specifies short-specific values. Keeps the parameter set minimal and deterministic; short-side nuances can be a versioned future review. *Provisional — Master Spec overrides.*

## P-13. **Gap-through-stop** handling
- **Purpose:** Define the exit reference price when the mark **gaps past** the trail/hard-stop level (i.e., between cycles the price jumps beyond the stop, so no mark ever printed exactly at the stop).
- **Where used:** Exit Decision Engine + close execution (EX-1/EX-2); determines `exit_price`, hence realized PnL.
- **Required owner decision:** When price gaps through the stop, is the fill modeled at the **stop level** or at the **actual gapped mark**?
- **Alternatives:**
  - **(a) Fill at the actual current mark** (the gapped price) — realistic; a stop is not a guaranteed price.
  - **(b) Fill at the stop level** (assume the stop got the exact price) — optimistic; understates losses/overstates results.
  - **(c) Fill at the worse of stop vs mark.**
- **Pros / Cons:** (a) honest, conservative, consistent with paper OD-4 ("fill at the supplied mark, no slippage") — and avoids inflating campaign metrics. (b) **biases validation favorably** (a stop guarantees execution but not price); would make the campaign's win-rate/PF unrealistic. (c) equivalent to (a) for adverse gaps.
- **Recommended:** **(a) Fill at the actual current mark.** It is consistent with the existing paper-fill convention (supplied mark, no slippage), it is conservative, and it keeps validation metrics honest. **This is a correctness decision, not just a parameter** — recommending (b) would manufacture better-than-real results. *Strongly recommended.*

## P-14. **Close-order execution assumptions**
- **Purpose:** Define how the closing (exit) order is modeled in paper execution.
- **Where used:** D5 close-execution method (EX-2) + PaperTarget close path (EX-3).
- **Required owner decision:** Confirm the paper close-order assumptions.
- **Alternatives / sub-decisions:**
  - **Fill quantity:** **full position quantity** (full-close only, per `OWNER_PROFIT_POLICY` Rule 7) vs partial (deferred/forbidden in v1). → **Full.**
  - **Fill price:** the supplied mark, **no slippage** (OD-4 symmetry) vs modeled slippage. → **No slippage** for v1.
  - **Fill timing:** **immediate full fill** (symmetric to entry) vs delayed/partial fills. → **Immediate.**
  - **Order tagging:** reuse `broker_ref="paper:<uuid>"` (OD-5, no schema change) vs new field. → **Reuse.**
  - **Order direction:** a long is closed by a **sell**, a short by a **buy**; the *position's* `direction` stays immutable so PnL math holds. → **Closing order is the opposite side; position direction unchanged.**
- **Pros / Cons:** Reusing the entry conventions (immediate, full, no-slippage, existing tag) keeps paper symmetric, deterministic, and schema-free; it is explicitly **not** a paper-only shortcut because the *mechanism* is the shared D5 path (only the fill is simulated, exactly as for entries). Modeling slippage now would add non-determinism and a parameter with no Master-Spec basis.
- **Recommended:** **Full quantity · supplied mark · no slippage · immediate fill · reuse `paper:` tag · closing order on the opposite side with immutable position direction.** *Recommended (consistent with approved D11 OD-4/OD-5).*

---

## Summary decision table

| # | Parameter | Required decision | Recommendation (provisional; Master Spec overrides) |
|---|---|---|---|
| P-1 | Core trail type | measurement basis | **Percentage** (zero data change) |
| P-2 | Core trail value | the number | **Master Spec — not fabricated** |
| P-3 | Core arming | when trail engages | **Arm at entry + hard-stop** |
| P-4 | Core hard-stop | exists? value? | **Yes, fixed-% ; value = Master Spec** |
| P-5 | Turbo trail type | measurement basis | **Percentage** |
| P-6 | Turbo trail value | the number | **Master Spec — tighter than Core** |
| P-7 | Turbo arming | when trail engages | **Arm at entry + hard-stop** |
| P-8 | Turbo hard-stop | exists? value? | **Yes, tighter than Core; value = Master Spec** |
| P-9 | Turbo session-close | flat at close? | **Force-flat at session close (cutoff = Master Spec)** |
| P-10 | Kill-switch ↔ exits | which levels block exits | **Exits at L1–L3; only L4 halts (asymmetric)** |
| P-11 | Exit frequency | cadence | **Every trading cycle (reuse worker)** |
| P-12 | Long/Short symmetry | mirror or distinct | **Full symmetry for v1** |
| P-13 | Gap-through-stop | fill at stop or mark | **Actual mark (honest, conservative)** |
| P-14 | Close-order assumptions | paper fill model | **Full · supplied mark · no slippage · immediate · reuse tag** |

---

## Critical notes for the owner

1. **Two items are strategy values this report will not fabricate: P-2 (Core trail value) and P-6 (Turbo trail value)** — plus the *values* under P-4/P-8 (hard-stop sizes) and the *cutoff* under P-9. These **must** come from the Master Specification. Everything else (types, arming shape, symmetry, kill-switch interaction, frequency, gap handling, close-order model) is a structural/behavioral decision the report recommends and the owner ratifies.
2. **Data-path constraint (G-1):** an ATR/volatility-based trail (P-1/P-5 option b) is **not implementable without a new data path** to carry per-cycle ATR for open positions — that is a schema/data-architecture change requiring its own gated phase. Percentage-based trails avoid this entirely. If the Master Spec mandates ATR, that data phase must precede EX-1.
3. **Two recommendations are correctness, not preference: P-10 (kill-switch must not trap positions — exits allowed L1–L3)** and **P-13 (gap fills at the actual mark, not the stop)**. Choosing the alternatives would either trap risk or inflate validation metrics; both are strongly advised.
4. **Session-close (P-9)** and **exit frequency (P-11)** impose data/orchestration inputs (a session-boundary signal; the cycle interval matching the engine timeframe). These become EX-4 and OR-2 inputs once decided.

---

## Stop gate

**STOP — decision report only. Awaiting owner decisions.**

No code, no implementation, no architecture/schema change, no fixtures. EX-1…EX-5 and OR-2 remain paused. The build cannot begin until the owner (a) decides P-1…P-14 and (b) supplies the Master-Spec strategy values for P-2, P-6, the hard-stop sizes (P-4/P-8), and the P-9 cutoff. No broker / TradingView / IBKR / live trading.
