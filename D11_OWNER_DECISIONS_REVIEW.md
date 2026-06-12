# D11_OWNER_DECISIONS_REVIEW

**Type:** Architecture review of owner decisions. **No code. No tests. No implementation.**
**Reviews:** `D11_OWNER_DECISIONS.md` (OD-1…OD-11) against `D11_EXECUTION_TARGETS_ARCHITECTURE.md`, approved B1–B9 artifacts, `D10_TRADINGVIEW_INTEGRATION_ARCHITECTURE.md`, and `B9_OWNER_POLICY_UPDATE.md`.
**Goal:** give the owner a decision-ready analysis — per-decision detail, cross-layer impact, classification (approve-now / defer / critical / optional), and a final recommended approval set.

**Legend — Criticality:** **CRITICAL** = blocks D11 implementation start; **IMPORTANT** = shapes the build but not blocking; **OPTIONAL** = can be decided later without rework.
**Timing:** **APPROVE NOW** = needed before D11 implementation; **DEFER** = safe to decide at a later, scheduled phase.

---

## OD-1 — Default execution target

1. **Description:** Which target is active when `EXECUTION_TARGET` is unset.
2. **Recommended option:** **Signals Only.**
3. **Benefits:** Safest possible default; zero external dependencies; cannot create orders or touch a broker by accident; aligns with the project's fail-safe ethos.
4. **Risks:** Execution paths (Paper/IBKR) are not exercised unless deliberately enabled — acceptable and intended.
5. **Alternatives:** Paper (exercises execution early, but creates orders sooner than intended); require explicit selection (friction; fail-on-unset).
6. **Impact:**
   - **D1–D10:** none — selection happens at the B9 integration layer; core untouched.
   - **Paper:** opt-in only.
   - **TradingView:** unaffected (independent, optional).
   - **IBKR:** opt-in only; never default.
   - **Future subscriptions:** the safe default maps cleanly to the lowest entitlement tier.
- **Classification:** **CRITICAL · APPROVE NOW** (every startup needs a defined default).

---

## OD-2 — Placement of the `ExecutionTarget` abstraction

1. **Description:** Where the new seam lives.
2. **Recommended option:** **Integration layer (`src/app/targets/`, beside B9).**
3. **Benefits:** Pure composition/wiring; no D5 change; honors the freeze; mirrors how B9 already wires `ExecutionEngine` + mock broker.
4. **Risks:** Slight indirection between the pipeline tail and D5 — minimal.
5. **Alternatives:** Inside `src/execution` (D5) — **modifies a frozen layer, disallowed**; a new top-level package — more surface for little gain.
6. **Impact:**
   - **D1–D10:** none modified (the disallowed alternative would have changed D5).
   - **Paper / IBKR:** both compose D5 from this layer.
   - **TradingView:** outbound target also lives here.
   - **Future subscriptions:** entitlement gate sits naturally at this composition point.
- **Classification:** **CRITICAL · APPROVE NOW** (determines where all D11 code is allowed to live without breaking the freeze).

---

## OD-3 — TradingView "Mode B" direction confirmation

1. **Description:** Confirm Mode B is **outbound** distribution (THUL-NURAYN → TradingView), distinct from D10 inbound ingestion.
2. **Recommended option:** **Outbound distribution only; D10 inbound remains independent and optional.**
3. **Benefits:** Matches the requirement text ("TradingView receives signals … distribution layer"); avoids conflating two opposite data flows.
4. **Risks:** Operating two independent TradingView channels (D10 in, D11 out) if both are ever enabled — manageable, each optional.
5. **Alternatives:** Reuse D10 semantics (contradicts the stated purpose); enable both directions together (more to secure/operate).
6. **Impact:**
   - **D1–D10:** none; D10 stays as-is and independent.
   - **Paper / IBKR:** none.
   - **TradingView:** defines Mode B precisely (outbound, no strategy logic, optional).
   - **Future subscriptions:** outbound distribution can be a tier feature.
- **Classification:** **IMPORTANT · APPROVE NOW** (a definitional clarification that prevents design ambiguity; cheap to confirm now).

---

## OD-4 — Paper fill simulation policy

1. **Description:** How the Paper target simulates fills (must not change sizing/strategy).
2. **Recommended option:** **Immediate full fill at a supplied mark/last price, no slippage** (first paper phase).
3. **Benefits:** Deterministic, simplest, validates the full execution→fill→portfolio wiring; keeps simulation out of strategy/risk territory.
4. **Risks:** Less realistic than live fills; could mask slippage/latency effects — acceptable for wiring validation, revisit later.
5. **Alternatives:** Configurable partial fills; slippage/latency model — more realistic but adds modeling that must be kept clear of risk/sizing rules.
6. **Impact:**
   - **D1–D10:** none — uses existing D5 `ExecutionEngine`/`apply_fill`; D6 computes PnL from the simulated fill unchanged.
   - **Paper:** defines its core behavior.
   - **TradingView:** none.
   - **IBKR:** sets a realism baseline that the real adapter will later exceed.
   - **Future subscriptions:** none.
- **Classification:** **CRITICAL · APPROVE NOW** (Paper cannot be built without a fill policy; it is the heart of Mode C).

---

## OD-5 — Paper vs live row differentiation (no schema change)

1. **Description:** How paper/live/(future) IBKR rows are distinguished in the shared `orders`/`positions`/`fills` tables.
2. **Recommended option:** **`broker_ref` prefix convention (`paper:`/`ibkr:`) + audited active mode.**
3. **Benefits:** No schema change; honors the freeze; audit-complete; works for paper now and IBKR later.
4. **Risks:** Convention discipline required in queries/reports; a new `mode` column would be cleaner typing but needs schema change.
5. **Alternatives:** New `mode`/`source` column or separate per-mode tables — **schema change → versioned approval; breaks current freeze.**
6. **Impact:**
   - **D1–D10:** none (reuses existing `broker_ref` free-text field; no model/schema change).
   - **Paper:** rows tagged `paper:`.
   - **TradingView:** n/a (no orders in that mode — see OD-10).
   - **IBKR:** rows tagged `ibkr:`; same tables, same recovery.
   - **Future subscriptions:** reporting can segment by tier via the convention.
- **Classification:** **CRITICAL · APPROVE NOW** (touches how every executed row is identified; cheap now, expensive to retrofit).

---

## OD-6 — Subscription entitlement source

1. **Description:** Where the subscription capability that gates the active target comes from.
2. **Recommended option:** **Config/governance entitlement input now; full subscription system deferred.**
3. **Benefits:** Fail-closed gating works immediately with no new system; consistent with the governance-policy approach.
4. **Risks:** Manual/config entitlement is not productized — fine for now.
5. **Alternatives:** Full subscription/billing system (large future scope); hard-coded single tier (inflexible).
6. **Impact:**
   - **D1–D10:** none.
   - **Paper / IBKR:** availability gated by entitlement at startup (fail-closed).
   - **TradingView:** can be a tier feature.
   - **Future subscriptions:** establishes the entitlement seam a real system can later populate.
- **Classification:** **IMPORTANT · APPROVE NOW for the seam; full system DEFER** (the gating mechanism is needed; the billing system is a future phase).

---

## OD-7 — Multi-broker cardinality

1. **Description:** Whether more than one broker/target can be active at once.
2. **Recommended option:** **One active target per process now; multi-broker as a future additive capability.**
3. **Benefits:** Simple; matches the single-process synchronous stack; the seam already permits future multi-broker without D5/schema change.
4. **Risks:** None material now; routing complexity deferred.
5. **Alternatives:** Multi-broker routing now — premature, adds ordering/routing complexity.
6. **Impact:**
   - **D1–D10:** none.
   - **Paper / IBKR:** exactly one active; clean semantics.
   - **TradingView:** independent of broker cardinality.
   - **Future subscriptions:** multi-broker could become a premium tier later (additive).
- **Classification:** **OPTIONAL · DEFER** (decision is "do nothing extra now"; revisit when multi-broker is actually wanted).

---

## OD-8 — Interactive Brokers adapter scope & timing

1. **Description:** When/whether to build the IBKR `BrokerSyncContract` adapter.
2. **Recommended option:** **Definition only now; implement later via formal review + versioned approval, after a successful paper period.**
3. **Benefits:** Staged, lowest risk; no live-money exposure until paper validation; honors "no implementation."
4. **Risks:** Live trading is delayed — intended.
5. **Alternatives:** Build the adapter now (live risk before paper validation; violates "no implementation"); never (paper-only product).
6. **Impact:**
   - **D1–D10:** none now.
   - **Paper:** must precede IBKR (migration path).
   - **TradingView:** none.
   - **IBKR:** explicitly future/owner-gated.
   - **Future subscriptions:** IBKR maps to the highest (live) tier.
- **Classification:** **CRITICAL (as a boundary) · APPROVE NOW** — i.e., approve "**definition only, no build**" now so D11 cannot drift into broker code; the **build** itself is **DEFERRED** to a future phase.

---

## OD-9 — Mode-change governance (when can the active target change)

1. **Description:** Whether the execution target may change at runtime or only at controlled times.
2. **Recommended option:** **Change only before session start (or via restart), forward-only** — mirroring the capital/allocation governance policy.
3. **Benefits:** Safe, auditable, governance-consistent; avoids orphaning in-flight orders by switching mode mid-session.
4. **Risks:** Less operational flexibility — acceptable for a trading system.
5. **Alternatives:** Runtime hot-switch (high risk mid-session); redeploy-only (operationally heavy).
6. **Impact:**
   - **D1–D10:** none; consistent with `B9_OWNER_POLICY_UPDATE` change-window philosophy and B9 explicit-start (D6).
   - **Paper / IBKR:** mode set at startup; stable for the session.
   - **TradingView:** outbound distribution toggled at startup.
   - **Future subscriptions:** entitlement/mode changes follow the same forward-only governance.
- **Classification:** **IMPORTANT · APPROVE NOW** (defines safe operating rules before any execution mode exists).

---

## OD-10 — Do Signals/TradingView modes create `Order` rows?

1. **Description:** Whether non-execution modes persist `Order` rows or stop at `Signal`.
2. **Recommended option:** **Stop at `Signal`; create orders only in execution modes (Paper/IBKR).**
3. **Benefits:** Keeps `orders` meaningful (an order implies intent to execute); cleaner reporting; avoids polluting duplicate-protection space with never-executed orders.
4. **Risks:** Slightly different pipeline tail per mode — minor, clearly documented.
5. **Alternatives:** Create non-executed `Order` rows (uniform shape, but pollutes the orders table and duplicate fingerprints).
6. **Impact:**
   - **D1–D10:** none — both options use existing models; recommended option simply stops earlier.
   - **Paper / IBKR:** unchanged (they do create orders).
   - **TradingView / Signals:** stop at signal/notification.
   - **Future subscriptions:** order volume reflects only execution tiers.
- **Classification:** **CRITICAL · APPROVE NOW** (defines the pipeline tail and the meaning of the `orders` table across modes).

---

## OD-11 — Outbound notification channel for TradingView Mode

1. **Description:** The transport for outbound distribution (Mode B).
2. **Recommended option:** **A generic notification-sink abstraction (TradingView as one optional sink), specified when Mode B is scheduled.**
3. **Benefits:** Keeps the core TradingView-independent and the channel swappable; avoids premature provider coupling.
4. **Risks:** Mode B remains unspecified in detail until scheduled — acceptable (it is optional).
5. **Alternatives:** Couple directly to a single TradingView format now (provider lock-in); defer entirely.
6. **Impact:**
   - **D1–D10:** none (core stays TradingView-independent).
   - **Paper / IBKR:** none.
   - **TradingView:** defines Mode B's transport approach as pluggable.
   - **Future subscriptions:** notification channels can be tiered features.
- **Classification:** **OPTIONAL · DEFER** (only needed when Mode B is actually scheduled).

---

## Classification Summary

| # | Decision | Criticality | Timing | Recommended |
|---|----------|-------------|--------|-------------|
| OD-1 | Default target | **CRITICAL** | Approve now | Signals Only |
| OD-2 | Abstraction placement | **CRITICAL** | Approve now | Integration layer (`src/app/targets/`) |
| OD-3 | Mode B direction | Important | Approve now | Outbound only (distinct from D10) |
| OD-4 | Paper fill policy | **CRITICAL** | Approve now | Immediate full fill, no slippage |
| OD-5 | Paper/live differentiation | **CRITICAL** | Approve now | `broker_ref` convention + audit |
| OD-6 | Subscription entitlement | Important | Approve seam now; system defer | Config/governance now |
| OD-7 | Multi-broker cardinality | Optional | Defer | One active target/process |
| OD-8 | IBKR adapter | **CRITICAL boundary** | Approve "definition-only" now; build defer | Definition only now |
| OD-9 | Mode-change governance | Important | Approve now | Before-session/restart, forward-only |
| OD-10 | Orders in non-exec modes | **CRITICAL** | Approve now | Stop at Signal |
| OD-11 | TradingView outbound channel | Optional | Defer | Generic notification sink (later) |

**Approve now (8):** OD-1, OD-2, OD-3, OD-4, OD-5, OD-6 (seam), OD-9, OD-10.
**Approve as a boundary now, build later (1):** OD-8 (definition-only).
**Defer (2):** OD-7, OD-11 (and the full subscription system within OD-6).
**Critical (6):** OD-1, OD-2, OD-4, OD-5, OD-8 (boundary), OD-10.
**Optional (2):** OD-7, OD-11.

---

## Cross-Cutting Observations

- **Freeze safety:** every recommended option avoids schema/table/enum changes and any D1–D10 modification. The only option that would break the freeze (a `mode` column under OD-5, or in-D5 placement under OD-2) is **not** recommended.
- **Governance consistency:** OD-9 (mode-change window) and OD-6 (entitlement changes) align with the ratified `B9_OWNER_POLICY_UPDATE` (forward-only, change-window) — no historical recalculation.
- **Separation preserved:** no recommended option lets a target score, gate, or size — Portfolio ⟂ Risk ⟂ Execution and the Score-Engine-as-truth invariant hold in all modes.
- **Migration coherence:** OD-1/OD-4/OD-5/OD-8/OD-10 together make the Signals → Paper → IBKR path a sequence of config/mode changes with identical schema and recovery — no data migration.

---

## Final Recommended Approval Set (for owner sign-off)

> Approving this set unblocks D11 implementation of **Signals Only + Paper** (with **TradingView outbound** and **IBKR** deferred), with no freeze violation.

1. **OD-1:** Default = **Signals Only.**
2. **OD-2:** Abstraction in the **integration layer** (`src/app/targets/`); no D5 change.
3. **OD-3:** Mode B = **outbound distribution only**, independent of D10; TradingView optional.
4. **OD-4:** Paper fills = **immediate full fill at supplied mark, no slippage** (phase 1).
5. **OD-5:** Paper/live differentiation via **`broker_ref` convention + audit** (no schema change).
6. **OD-6:** Subscription **entitlement seam via config/governance now**; full subscription system **deferred**.
7. **OD-8:** Interactive Brokers = **definition only now**; build deferred to a future owner-gated, versioned phase after paper validation.
8. **OD-9:** Mode changes **before session start / via restart, forward-only.**
9. **OD-10:** Non-execution modes **stop at `Signal`** (no orders); orders only in Paper/IBKR.
10. **Defer:** **OD-7** (single active target now) and **OD-11** (generic notification sink, define when Mode B is scheduled).

**Net effect if approved:** D11 may implement the **execution-target abstraction + Signals Only + Paper Trading** strictly at the integration layer, with TradingView-outbound and IBKR as later owner-gated additions — all without any schema/table/enum change and without modifying D1–D10.

---

## Stop Gate

**STOP.**

Architecture review only — no code, no tests, no implementation. Awaiting owner sign-off on the **Final Recommended Approval Set** (and explicit rulings on the deferred items OD-7, OD-11, and the OD-8 build timing) before any D11 implementation begins.
