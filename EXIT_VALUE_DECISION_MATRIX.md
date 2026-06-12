# EXIT_VALUE_DECISION_MATRIX

**Type:** Numeric decision matrix. **No implementation. No code. No final values recommended.**
**Status:** **OPEN — awaiting owner numeric decisions.** Reduces `OWNER_EXIT_DECISION_MATRIX.md` item **X-5** to the smallest possible set of explicit numeric inputs needed to unblock EX-1.
**Builds on the ratified philosophy:** Core = structure/trend exit + hard-stop-only (winners run, no fixed target); Turbo = hard stop + break-even + trailing + mandatory session flatten; full close only; long/short symmetry; gap-fills-at-actual-price; exits during L1–L3.

---

## 0. Read-this-first (scope, framing, disclaimers)

**These are illustrative decision-support brackets, NOT recommendations and NOT approved values.** The owner explicitly requested *reasonable operating ranges* and *aggressive / moderate / conservative examples*; per instruction, **no final value is recommended**. The owner-held **Master Specification remains authoritative** — if it states a value, that value is transcribed and these brackets are discarded (`EXIT_PARAMETER_SOURCE_AUDIT.md`: no exit values exist in-repo).

**The numeric surface is deliberately small.** Because the Core structure/trend triggers **reuse existing boolean definitions** (`trend_stage2`, the Bull-regime band `REGIME_BAND = 0.01`, breakout facts — all already frozen in `src/selection/constants.py`), they require **no new number**. Likewise the kill-switch, full-close, symmetry, and gap-fill rules are already decided and carry no value. What remains is **6 required numbers + 2 optional**.

**Axis definition (applied consistently to every row):**
- **Conservative** = prioritizes **capital protection / smaller drawdown** (tighter stop, earlier break-even, tighter trail, earlier session exit). Tends to ↑ measured win rate, ↓ profit factor, ↓ drawdown, ↑ recovery speed.
- **Aggressive** = prioritizes **letting trades run / capturing more move** (wider stop, later break-even, wider trail, later session exit). Tends to ↓ win rate, ↑ profit factor, ↑ drawdown, ↓ recovery speed.
- **Moderate** = balanced.

**Basis assumption for the numbers below:** values are shown as **% of entry price** unless an **ATR-multiple** basis is chosen (T-1 / T-4 / C-2 from the prior matrix). Where ATR is a live option (Turbo only — `CoreCandidateInput` has no `atr` field), an ATR-multiple bracket is given alongside. The **basis selection itself is a non-numeric decision** already listed in `OWNER_EXIT_DECISION_MATRIX` (C-2, T-1, T-4); this document only supplies the numeric brackets once a basis is chosen.

---

## 1. Required numeric values (block EX-1)

### V-1 — Core hard-stop distance
- **Parameter name:** `core_hard_stop_distance`
- **Engine:** Core
- **What it controls:** The protective downside floor for a Core position (the only hard exit; profit-side exit is the boolean structure/trend break). Closes the position if price falls this far below entry.
- **Sensitivity:** **High**
- **Effect on:**
  - *Win rate:* tighter → more floor hits → ↓ WR; wider → fewer hits → ↑ WR.
  - *Profit factor:* tighter caps loss size (↑ PF) but can clip trades that would have resumed (↓ PF); wider lets trades survive noise (↑ PF) but enlarges realized losses (↓ PF). Net depends on how often the floor (vs the structure exit) is the actual exit.
  - *Drawdown:* tighter → ↓ DD (primary lever for the −10% gate); wider → ↑ DD.
  - *Recovery:* tighter → faster; wider → slower.
- **Reasonable operating range (% of entry):** ~**5%–15%** (swing-engine norm). *(ATR basis not available for Core.)*
- **Aggressive (wide):** ~**12–15%** · **Moderate:** ~**8%** · **Conservative (tight):** ~**5%**

### V-2 — Turbo hard-stop distance
- **Parameter name:** `turbo_hard_stop_distance`
- **Engine:** Turbo
- **What it controls:** The protective floor for an intraday Turbo position (long or short, mirrored).
- **Sensitivity:** **High**
- **Effect on:**
  - *Win rate:* tighter → more stop-outs → ↓ WR; wider → ↑ WR.
  - *Profit factor:* tighter caps loss (↑) but more frequent small losses (↓); wider = fewer but larger losses.
  - *Drawdown:* tighter → ↓ DD; wider → ↑ DD.
  - *Recovery:* tighter → faster.
- **Reasonable operating range:** **% basis** ~**1%–4%**; **ATR basis** ~**1×–3× ATR(entry)**.
- **Aggressive (wide):** ~**3–4%** / **~3× ATR** · **Moderate:** ~**2%** / **~1.5–2× ATR** · **Conservative (tight):** ~**1%** / **~1× ATR**

### V-3 — Turbo break-even arming trigger
- **Parameter name:** `turbo_breakeven_trigger`
- **Engine:** Turbo
- **What it controls:** The favorable move that **arms** the break-even transition (after this much profit, the stop moves to the break-even level V-4).
- **Sensitivity:** **Medium–High**
- **Effect on:**
  - *Win rate:* earlier arming → more trades defended but more scratch exits (interacts with V-4 / the win=PnL>0 convention) → WR effect ambiguous; later arming → fewer scratches → ↑ WR of those that run.
  - *Profit factor:* earlier arming can neutralize downside before a move matures (slightly ↓ PF if it ends trades early via tag); later arming preserves upside (↑ PF) at more downside risk.
  - *Drawdown:* earlier → ↓ DD; later → ↑ DD.
  - *Recovery:* earlier → faster.
- **Reasonable operating range:** **% basis** ~**0.5%–3%** favorable; **ATR basis** ~**0.5×–1.5× ATR** favorable.
- **Aggressive (arm late):** ~**3%** / **~1.5× ATR** · **Moderate:** ~**1.5%** / **~1× ATR** · **Conservative (arm early):** ~**0.5–1%** / **~0.5× ATR**

### V-4 — Turbo break-even level offset *(the scratch-as-loss control)*
- **Parameter name:** `turbo_breakeven_offset`
- **Engine:** Turbo
- **What it controls:** Where the stop sits **once armed** — at exact entry (PnL = 0) or marginally above, so a defended trade books as a small **win** rather than a loss (recall: the frozen convention counts PnL = 0 as a loss).
- **Sensitivity:** **Medium** (small DD effect; **direct** effect on the *measured* win rate).
- **Effect on:**
  - *Win rate:* larger positive offset → defended trades book as wins → ↑ measured WR; exact-entry (zero offset) → scratches book as losses → ↓ measured WR.
  - *Profit factor:* larger offset locks a small gain (slightly ↑ PF) but can be tagged on minor pullbacks, ending some runners early (slightly ↓ PF).
  - *Drawdown:* minimal effect (offset is at/above entry).
  - *Recovery:* minimal.
- **Reasonable operating range:** from **just above entry** (cover round-trip costs) up to ~**+0.5%**.
- **Aggressive (minimal offset, most room):** ~**+0.05–0.1%** (barely above costs) · **Moderate:** ~**+0.2–0.3%** · **Conservative (lock a clear win):** ~**+0.5%**

### V-5 — Turbo trailing-stop distance
- **Parameter name:** `turbo_trailing_distance`
- **Engine:** Turbo
- **What it controls:** The distance the trailing stop follows behind the favorable extreme (after break-even arms) — the mechanism that lets Turbo winners run intraday.
- **Sensitivity:** **High**
- **Effect on:**
  - *Win rate:* tighter trail → locks gains sooner, more small wins → ↑ WR; wider → ↓ WR (more give-back round-trips).
  - *Profit factor:* tighter → cuts winners short → ↓ PF; wider → captures larger moves → ↑ PF.
  - *Drawdown:* tighter → ↓ give-back → ↓ DD; wider → ↑ DD.
  - *Recovery:* tighter → faster.
- **Reasonable operating range:** **% basis** ~**1%–4%**; **ATR basis** ~**1×–2.5× ATR**.
- **Aggressive (wide, let run):** ~**3–4%** / **~2.5× ATR** · **Moderate:** ~**2%** / **~1.5× ATR** · **Conservative (tight, lock gains):** ~**1%** / **~1× ATR**

### V-6 — Turbo session-close cutoff
- **Parameter name:** `turbo_session_close_cutoff`
- **Engine:** Turbo
- **What it controls:** How long **before the session close** all Turbo positions are force-flattened (the "intraday / no overnight" guarantee). *(Session boundary is already detectable via the existing `market_open` frame flag; only the cutoff is a value.)*
- **Sensitivity:** **Medium**
- **Effect on:**
  - *Win rate:* earlier cutoff → avoids late-session reversals → ↑ WR; later → exposed to closing volatility → WR effect mixed.
  - *Profit factor:* earlier → may cut late runners → ↓ PF; later → captures full-session moves → ↑ PF.
  - *Drawdown:* earlier → ↓ end-of-day reversal risk → ↓ DD; later → ↑ DD.
  - *Recovery:* minor.
- **Reasonable operating range:** **0–30 minutes before close** (i.e., "at the last open frame" up to "30 min early").
- **Aggressive (capture full session):** **at close / last open frame (~0 min)** · **Moderate:** ~**5–10 min before** · **Conservative (exit early):** ~**15–30 min before**

---

## 2. Optional numeric values (not required for EX-1; only if the owner elects them)

### V-7 (optional) — Core structure-break confirmation buffer
- **Parameter name:** `core_structure_break_buffer`
- **Engine:** Core
- **What it controls:** An optional cushion **beyond** the boolean structure/trend flip before exiting (e.g., require price to break the structure level by this much to confirm), reducing whipsaw on marginal flips. **If omitted, Core exits on the existing boolean flip with no number.**
- **Sensitivity:** **Medium**
- **Effect on:**
  - *Win rate:* larger buffer → stays in through noise → ↓ WR (more give-back); zero → exits on flip → ↑ WR.
  - *Profit factor:* larger → fewer false exits, bigger winners → ↑ PF; zero → ↓ PF.
  - *Drawdown:* larger → ↑ DD (gives back more before confirming); zero → ↓ DD.
  - *Recovery:* larger → slower.
- **Reasonable operating range (% beyond the level):** **0%–3%**.
- **Aggressive (require deep break):** ~**2–3%** · **Moderate:** ~**1%** · **Conservative (exit on flip):** ~**0%** (no buffer)

### V-8 (optional) — Core hard-stop intraday vs EOD note
- Not a numeric value but a reminder: per `OWNER_EXIT_DECISION_MATRIX` C-4, if the Core hard stop is **EOD/close-based** (recommended for a swing engine), V-1 is evaluated at the daily close; no additional number is introduced. If the owner instead funds intraday Core monitoring, that is an operational/scope decision, still using the V-1 value.

---

## 3. Summary — the small set X-5 reduces to

| ID | Parameter | Engine | Basis | Sensitivity | Required? |
|---|---|---|---|---|---|
| **V-1** | Core hard-stop distance | Core | % (ATR n/a) | High | **Required** |
| **V-2** | Turbo hard-stop distance | Turbo | % or ATR× | High | **Required** |
| **V-3** | Turbo break-even trigger | Turbo | % or ATR× | Med–High | **Required** |
| **V-4** | Turbo break-even offset | Turbo | % | Medium | **Required** |
| **V-5** | Turbo trailing distance | Turbo | % or ATR× | High | **Required** |
| **V-6** | Turbo session-close cutoff | Turbo | minutes | Medium | **Required** |
| V-7 | Core structure-break buffer | Core | % | Medium | *Optional* |
| V-8 | Core stop cadence (EOD vs intraday) | Core | — | — | *Operational (C-4)* |

**Six required numbers** (V-1…V-6), each long/short-symmetric (Turbo) per the ratified direction; **two optional**. Confirming the **basis** (% vs ATR) for V-2/V-3/V-5 (and V-1 = % by necessity) accompanies the numbers. Once these six are supplied — from the Master Spec, or set explicitly by the owner if the Master Spec is silent — **X-5 is resolved and the remaining EX-1 blockers are the non-numeric items already in `OWNER_EXIT_DECISION_MATRIX` (C-1/C-2/C-3/C-4 selections, T-1/T-4 basis, X-1/X-2/X-4)**.

---

## 4. Stop gate

**STOP — value matrix only. Awaiting owner numeric decisions.**

No final values recommended, no values invented as approved, no implementation, no code. The brackets above are illustrative decision-support; the Master Specification is authoritative. EX-1…EX-5 and OR-2 remain paused. No broker / TradingView / IBKR / live trading.
