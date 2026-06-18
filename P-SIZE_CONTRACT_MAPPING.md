# P-SIZE_CONTRACT_MAPPING

**Type:** Contract audit for P-SIZE (pre-/with-implementation). **No new DTOs/entities/tables/enums/schemas/policies introduced.**
**Verified against:** `P-SIZE_ARCHITECTURE.md` · D3 `facts.py` (`ScoredCandidate`) · D11 `ExecutionIntent` · B9 `bootstrap.py` (`STARTING_CAPITAL`) · `B9_OWNER_POLICY_UPDATE.md` (Position Allocation) · `OperationsConfig`.

---

## 1. Inputs Consumed by P-SIZE

| Input | Type | Source | Used in arithmetic? |
|-------|------|--------|---------------------|
| `candidate` | `Any` (a D3 `ScoredCandidate` at runtime) | upstream (D3→D4 accepted) | **No** — contextual only (per req 13; quantity uses capital/allocation/price only) |
| `settings.capital` | `Decimal` | owner config (`STARTING_CAPITAL`) | **Yes** (base; non-compounding) |
| `settings.allocation_fraction` | `Decimal` | owner config (Position Allocation) | **Yes** |
| `mark` | `Optional[Decimal]` | P-DATA frame (price) | **Yes** |

**No other inputs exist** — no risk, drawdown, volatility, ATR, equity, win-rate, or Kelly input is consumed (verified by signature + tests).

## 2. Outputs Produced by P-SIZE

| Output | Type | Notes |
|--------|------|-------|
| `SizingResult.quantity` | `int` | whole shares; **0** when not tradable |
| `SizingResult.tradable` | `bool` | `False` ⇒ No Trade |
| `SizingResult.reason` | `str` | always set; explicit reason (e.g. `"ok"`, `"missing mark"`, `"unaffordable …"`) |
| `SizingResult.capital_base` | `Decimal` | the owner capital used as base |
| `SizingResult.allocation_value` | `Decimal` | `capital × allocation_fraction` |

`quantity` flows downstream into the **existing** `ExecutionIntent.quantity` (`int`) / `Order.quantity` (`int`) — P-SIZE itself constructs neither (that is P-ORCH's role). **`SizingResult`/`CapitalSettings` are transient value objects** explicitly described in `P-SIZE_ARCHITECTURE.md` §2 — **not D1 entities, not persisted, not enums/tables/schemas.**

## 3. Configuration Fields Used

| Env key | Meaning | Status |
|---------|---------|--------|
| `STARTING_CAPITAL` | owner base capital | **Pre-existing** — already read by B9 `bootstrap.py` (B9 OD-D1). |
| `POSITION_ALLOCATION_FRACTION` | owner per-trade allocation fraction | Implementation key for the **already-approved** "Position Allocation" owner setting (`B9_OWNER_POLICY_UPDATE`; P-SIZE §4). **The setting is approved; the exact env-key name is the implementation detail — flagged for owner confirmation (OD-PSIZE-3). No new policy/DTO/schema.** |

`OperationsConfig` (B8) is **not modified** and does not hold capital/allocation (verified). No new configuration *field/policy* is introduced beyond the approved Position-Allocation setting's env key.

## 4. Existing Models Touched

**None.** P-SIZE imports **no** D1 model and writes **no** entity. It receives a `candidate` (D3 `ScoredCandidate`, unmodified, read-nothing) and returns a transient `SizingResult`. `Order`/`ExecutionIntent` are populated downstream by P-ORCH, not by P-SIZE.

## 5. Audit Events Generated

**P-SIZE emits none directly** (it has no DAL/Redis dependency and writes nothing). It **provides the `reason`** that P-ORCH records as the **Sizing audit event** (`system_events` `GatewayEvent`: capital base, allocation, quantity / No-Trade reason — existing member; no new enum/table). This matches P-ORCH §8 and P-SIZE §8.

## 6. Validation Rules (→ No Trade, never fabricate)

| Rule | Result |
|------|--------|
| `mark is None` | No Trade — `"missing mark"` |
| `mark` not `Decimal` | No Trade — `"invalid mark type"` |
| `mark <= 0` | No Trade — `"invalid mark (…)"` |
| `capital <= 0` | No Trade — `"invalid capital (…)"` |
| `allocation_fraction <= 0` or `> 1` | No Trade — `"invalid allocation fraction (…)"` (**never clamped**) |
| `floor(capital×fraction ÷ mark) < 1` | No Trade — `"unaffordable …"` |
| otherwise | `tradable=True`, `quantity = floor(capital×fraction ÷ mark)` |

`CapitalSettings.from_env` raises `ValueError` only on **missing/unparseable** config (deployment fail-fast); semantically-invalid-but-parseable values flow to `size()` → No Trade.

## 7. Conformance Statement

- **Only existing approved contracts used:** `ScoredCandidate` (D3, read-context), `Decimal`/`int` (stdlib), the existing `ExecutionIntent.quantity` downstream.
- **No new DTO/entity/table/enum/schema/policy** beyond the transient `SizingResult`/`CapitalSettings` value objects defined in `P-SIZE_ARCHITECTURE.md` §2.
- **No frozen file modified** (additive `src/app/sizing.py` only; verified by diff).
- **No risk/volatility/ATR/Kelly/dynamic/compounding inputs** (verified by signature + source-import scan).
