# D10_TRADINGVIEW_INTEGRATION_ARCHITECTURE

**Type:** Pre-implementation architecture review. **No code. No tests. No source changes. No schema changes.**
**Derived from:** `THUL-NURAYN_v1_MASTER_SPECIFICATION.md` · approved B1–B9 artifacts · `THUL_NURAYN_FINAL_REVIEW.md`.
**Status:** Architecture only — implementation forbidden until owner approval.
**Phase:** D10 — TradingView alert ingestion (signal source).

**Invariants preserved throughout:** PostgreSQL is the **sole source of truth** · Redis is **non-authoritative** · the **Score Engine (D3, Python) remains the single source of truth** · **Portfolio ⟂ Risk ⟂ Execution** intact · **no broker connectivity** · **no Interactive Brokers** · **no API/UI beyond the required webhook receiver** · no new tables · no new enums · no schema changes · **no modifications to D1–D9**.

---

## 1. Purpose

D10 integrates THUL-NURAYN with **TradingView alerts as an external signal source**. TradingView emits an alert when a chart condition fires; THUL-NURAYN receives that alert via a webhook, validates and authenticates it, translates it into a **candidate `Signal`** (the existing D1 entity), and hands it into the **existing** THUL-NURAYN pipeline (Score → Risk → Execution).

TradingView contributes **only a candidate signal**. It does **not** score, decide risk, size, or execute. All trading intelligence remains inside THUL-NURAYN exactly as built in D3–D6.

---

## 2. Core Principles (requirements 1–6)

| # | Requirement | Architectural commitment |
|---|-------------|--------------------------|
| 1 | TradingView is signal source only | TradingView supplies candidate signals; it is never authoritative for scoring, risk, sizing, or execution. |
| 2 | No strategy logic inside TradingView | TradingView alerts carry **no score, no risk decision, no sizing, no classification**. Any chart condition that triggers an alert is opaque to THUL-NURAYN and is treated only as "a candidate appeared." |
| 3 | No duplication of Selection/Risk/Execution logic | The webhook receiver **calls into** the existing D3/D4/D5 engines (via the B9-composed pipeline). It re-implements none of their logic. |
| 4 | TradingView sends alerts only | The only outbound action from TradingView is an HTTP POST alert. No state, no orders, no reads back. |
| 5 | Alerts received through webhook | A single inbound HTTP `POST` endpoint receives alerts. |
| 6 | Webhook passes signals into THUL-NURAYN | The receiver validates → maps to a `Signal` → submits it to the existing pipeline entry point. It does not bypass any downstream stage. |

**Single Source of Truth preserved:** the D3 **Score Engine (Python)** scores every TradingView candidate exactly as it scores internally-scanned candidates. **No score is ever accepted from TradingView.**

---

## 3. Position in the Architecture

```
        TradingView (external)
              │  HTTPS POST (alert JSON, signed)
              ▼
   ┌──────────────────────────────────────────────┐
   │  D10 Webhook Receiver  (the ONLY new surface)  │
   │   1. TLS terminate                              │
   │   2. Authenticate (HMAC + allowlist)            │
   │   3. Validate payload schema                    │
   │   4. Replay protection (window + nonce + DOP)   │
   │   5. Map → candidate Signal (D1)                │
   │   6. Submit to pipeline entry (B9)              │
   └───────────────┬────────────────────────────────┘
                   │ candidate Signal (no score, no decision)
                   ▼
   D3 Score Engine → D4 Risk Gate → D5 Execution → Fill → D6 Portfolio
        (UNCHANGED — single source of truth; Portfolio ⟂ Risk ⟂ Execution)

   Durability:  PostgreSQL (signals + audit) = truth
   Operational: B8 system_events (GatewayEvent) + alerting + DLQ
   Ephemeral:   Redis nonce cache (non-authoritative, TTL = accept window)
```

D10 sits **above B9**: it reuses the B9-composed `Application` (the wired D3/D4/D5 engines, DAL, B8 operations). It depends on D1 (Signal/Instrument/enums), D2 (DAL), D3 (scoring), B8 (operations), B9 (wiring). It **does not** depend on a broker, IBKR, or D7.

---

## 4. Signal Flow (ingestion path)

1. **Receive** — TradingView POSTs a JSON alert to the webhook endpoint over HTTPS.
2. **Authenticate** — verify the HMAC signature and (optionally) source IP allowlist (§7). Failure → 401, log, stop.
3. **Validate** — check payload schema and field domains (§6). Failure → 400, log, optional DLQ.
4. **Replay-protect** — enforce timestamp window + idempotency nonce + downstream `DuplicateOrderProtection` (§8). Duplicate/stale → idempotent no-op, log, stop.
5. **Resolve instrument** — map `symbol` (+ `market`) to an existing active `Instrument` via the DAL. Unknown/inactive → 422, log, DLQ.
6. **Translate** — construct a candidate D1 `Signal` (`engine`, `direction` from existing enums; `instrument_id`; `created_at = receive time UTC`). **No score, no risk fields.**
7. **Submit** — hand the `Signal` to the **existing** pipeline entry point (B9-wired): D3 scores/classifies it, D4 gates it, D5 executes if accepted, D6 reflects the result. D10 performs none of these computations.
8. **Acknowledge** — return `202 Accepted` after the candidate is durably captured; downstream processing failures route to the B8 DLQ (no auto-retry).

D10 owns **only steps 1–6 and the ack**. Steps 7's intelligence is entirely D3–D6, unchanged.

---

## 5. What D10 Does NOT Do (explicit non-scope)

- No scoring, classification, ranking (D3 owns it).
- No risk gates or kill-switch decisions (D4 owns it).
- No order/position state machines, no order submission (D5 owns it).
- No portfolio analytics or sizing (D6 / V2-001).
- **No broker connectivity; no Interactive Brokers** (requirements 8, 9).
- No outbound calls to TradingView; no polling; alerts are push-only.
- **No API/UI beyond the single webhook receiver** (requirement 10) — no dashboards, no REST CRUD, no auth UI.
- No new tables, enums, columns, or schema changes; no modification to D1–D9.

---

## 6. Alert Payload Structure (requirement 11)

TradingView alerts are JSON sent in the alert message body. The **payload carries no strategy output** — only identity, routing, and integrity fields.

```jsonc
{
  "schema_version": "1",            // payload contract version (string)
  "alert_id": "9f1c…uuid",          // unique per alert — idempotency key (required)
  "timestamp": "2026-06-10T14:32:05Z", // ISO-8601 UTC, alert fire time (required)
  "symbol": "AAPL",                 // ticker (required)
  "market": "NASDAQ",               // "NASDAQ" | "NYSE" (maps to existing Market enum)
  "engine": "Core",                 // "Core" | "Turbo" (maps to existing EngineType)
  "direction": "Long",              // "Long" | "Short" (maps to existing Direction)
  "source": "tradingview",          // origin marker (constant)
  "context": {                      // OPTIONAL, non-authoritative hints only
    "tv_strategy": "…",             // free-form label; never used for scoring/risk
    "note": "…"
  }
}
```

**Mapping & rules:**
- `market` → existing `Market` enum (`NASDAQ`/`NYSE`); `engine` → `EngineType` (`Core`/`Turbo`); `direction` → `Direction` (`Long`/`Short`). **No new enums** — any value outside these domains is rejected (422 + DLQ).
- `symbol` (+ `market`) is resolved to an existing `Instrument`; unknown/inactive → reject. D10 never creates instruments.
- `context` is **advisory only** and is **never** consumed by D3/D4/D5 — it may be recorded in the operational audit trail for diagnostics.
- The signature is transported in an HTTP header (§7), not in the JSON body, so the body hashes cleanly.
- The payload contains **no `score`, no `classification`, no `quantity`, no `risk`** fields by contract; if present, they are ignored (the Score Engine is authoritative).

**Signal translation (no schema change):** the candidate maps onto the existing `Signal` fields (`id`, `created_at`, `instrument_id`, `engine`, `direction`). The **TradingView origin and `alert_id`** are recorded in the **operational audit trail** (§7/§9) — **not** as new `Signal` columns. (Owner Decision OD-3 covers whether origin must be persisted on the signal itself, which would be a future versioned schema decision.)

---

## 7. Authentication & Security (requirement 12)

| Control | Design |
|---------|--------|
| **Transport** | HTTPS/TLS only; plaintext HTTP rejected. TLS terminated at ingress/receiver. |
| **Message authentication** | **HMAC-SHA256** over the raw request body using a shared secret, sent in a header (e.g., `X-TN-Signature`). Constant-time comparison. Invalid/missing → 401. |
| **Shared secret** | Stored in **environment/secret manager only** (e.g., `TRADINGVIEW_WEBHOOK_SECRET`). **Never in code, git, or logs** (consistent with B7/B8). Redacted by the B8 logging layer. |
| **Source allowlist** | Optional IP allowlist of TradingView webhook egress ranges (defense-in-depth; configurable). |
| **Endpoint obscurity** | Single POST path may include a non-guessable component (defense-in-depth only, not the primary control). |
| **Authorization** | The webhook is ingestion-only; it can create candidate signals but cannot read data, change settings, or touch risk/execution config. |
| **Rate limiting** | A simple inbound rate limit (per source) to bound abuse; over-limit → 429, logged. |
| **No secrets in logs** | All auth material redacted at the logging boundary (B8 `redact`). |

Authentication failures are **non-fatal to the system** (no pipeline entry) and recorded operationally (§9) at `Warning`.

---

## 8. Replay Protection (requirement 13)

A three-layer, freeze-respecting defense (no new table required):

1. **Timestamp acceptance window** — reject any alert whose `timestamp` is outside a configurable window (e.g., ±N seconds, clock-skew tolerant). Stale/replayed-late alerts are dropped (idempotent no-op).
2. **Idempotency nonce cache (Redis, non-authoritative)** — record each accepted `alert_id` with a TTL equal to the acceptance window. A repeat `alert_id` within the window → idempotent no-op (200/409). Redis is a cache only; correctness does not *depend* on it (see layer 3).
3. **Downstream `DuplicateOrderProtection` (D5, durable-backed)** — even if a duplicate candidate slips through (e.g., Redis cold after restart per the B9 Redis-cold invariant), the existing D5 fingerprint protection — rebuilt from in-flight orders on restart (B9 §8) — prevents a duplicate **order** from being created. This is the authoritative backstop.

**Restart safety:** Redis is cold on restart (B9 invariant), so the nonce cache may be briefly empty. The acceptance window bounds the replay exposure to a short interval, and the rebuilt `DuplicateOrderProtection` blocks any duplicate order. The composition is safe **without** a new durable nonce table.

> **Owner Decision OD-1:** whether a **durable inbound-alert dedup store** is required beyond {window + Redis nonce + D5 DuplicateOrderProtection}. Adding one would be a **future versioned schema decision** (new persisted entity) — out of the current freeze. Recommended default: the three-layer design above (no schema change).

---

## 9. Failure Handling (requirement 14)

All failures are **non-destructive**, recorded durably in the operational audit trail, and surfaced via B8 alerting. **No automatic retry** — manual DLQ resolution only (consistent with B5/B7/B8/B9).

| Condition | HTTP | Action |
|-----------|------|--------|
| Invalid/missing signature; not TLS; not allowlisted | 401/403 | No pipeline entry; record `Warning`; (optional) rate-limit |
| Malformed JSON / schema violation | 400 | Reject; record `Warning`; optional DLQ for triage |
| `engine`/`direction`/`market` outside existing enum domains | 422 | Reject; record `Warning`; DLQ |
| Unknown / inactive instrument symbol | 422 | Reject; record; DLQ for operator |
| Replay (duplicate `alert_id` / stale timestamp) | 200/409 | Idempotent no-op; record `Warning`; no duplicate signal |
| Rate limit exceeded | 429 | Reject; record |
| Candidate captured, downstream pipeline error | 202 (already acked) | Failed unit **dead-lettered** (B8 DLQ); no auto-retry; manual resolution |
| PostgreSQL unreachable | 503 | Do **not** acknowledge; record (best-effort); TradingView may resend per its own behavior (uncontrolled) |
| Redis unavailable | n/a | DEGRADED; nonce cache skipped; D5 DuplicateOrderProtection remains the backstop |

**Operational recording (no new enum/table):** inbound-alert lifecycle (received / accepted / rejected-reason / replay / auth-fail) is recorded as **`system_events` with `event_type = GatewayEvent`** and a JSONB `detail` carrying `{alert_id, symbol, engine, direction, outcome, reason}` — reusing an existing `SystemEventType` member exactly as B8 reused `WorkerFailure` for the DLQ. Append-only; partition-routed.

> **Owner Decision OD-2:** ratify recording inbound-alert lifecycle as `GatewayEvent` `system_events` rows (recommended), versus introducing a dedicated audit structure (future versioned schema decision).

---

## 10. Preserved D1–D9 Invariants (requirement 7)

| Invariant | How D10 preserves it |
|-----------|----------------------|
| PostgreSQL sole source of truth | Candidate signals persist as D1 `signals`; audit via `system_events`. Redis only caches nonces. |
| Redis non-authoritative | Nonce cache is a cache; D5 DuplicateOrderProtection is the durable backstop. |
| Score Engine single source of truth | D3 scores every TradingView candidate; no score accepted from TradingView. |
| Portfolio ⟂ Risk ⟂ Execution | D10 ingests candidates only; D3 scores, D4 decides, D5 executes, D6 reflects — unchanged. |
| No broker / no IBKR | D10 has zero broker code; execution still ends at the D5 boundary (mock in v1; D7 owner-gated). |
| No API/UI beyond webhook | Exactly one inbound POST endpoint; no other routes, no UI. |
| No new tables/enums/schema | Reuses `signals` + existing enums (`Market`/`EngineType`/`Direction`) + `system_events` (`GatewayEvent`). |
| No D1–D9 modification | D10 is a new layer that calls existing public interfaces; it changes none of them. |
| Fail-safe, no auto-retry | All failures → reject/DLQ; manual resolution. |
| No secrets in code/git/logs | Webhook secret via env; redacted in logs. |

---

## 11. Dependencies

**D10 depends on:** D1 (`Signal`, `Instrument`, `Market`/`EngineType`/`Direction`), D2 (DAL — instrument resolution + signal persistence), D3 (Score Engine — authoritative scoring of the candidate), B8 (alerting, DLQ, `system_events`), B9 (the composed `Application` / pipeline entry point + Redis client for the nonce cache).
**D10 does not depend on:** any broker, IBKR, D7, or a UI. **No circular dependencies** — D10 sits above B9.
**New third-party dependency (implementation-time, owner-gated):** a minimal HTTP server for the single webhook endpoint (framework choice deferred to the implementation review; this is the project's **first inbound network surface** and must be owner-approved).

---

## 12. Assumptions

1. **TradingView carries no intelligence.** Alerts are candidate triggers only; THUL-NURAYN's Score Engine is authoritative. Any score/size/risk field in a payload is ignored.
2. **Instruments pre-exist.** D10 resolves `symbol`→`Instrument`; it never creates instruments. Unknown symbols are rejected and dead-lettered.
3. **Origin recorded operationally, not on the entity.** TradingView origin + `alert_id` live in `system_events` (`GatewayEvent`) `detail`, not as new `Signal` columns (no schema change) — pending OD-3.
4. **Replay protection composes** {timestamp window + Redis nonce + D5 DuplicateOrderProtection} and is safe across the Redis-cold restart invariant, without a new durable nonce table (pending OD-1).
5. **Single inbound endpoint.** One POST route; no broader API. The HTTP framework is an implementation-review decision.
6. **Synchronous ingestion, async-free.** Consistent with the synchronous stack (B7–B9); the receiver validates synchronously and submits to the pipeline; failures dead-letter.
7. **TLS terminated at ingress.** Certificate/secret management is an operational deployment concern (no secrets in code).
8. **TradingView retry behavior is uncontrolled.** On a 5xx, TradingView may or may not resend; idempotency (alert_id + window + DOP) makes resends safe.

---

## 13. Owner Decisions Required (before implementation)

| # | Decision | Alternatives | Recommended |
|---|----------|--------------|-------------|
| **OD-1** | Durable inbound-alert dedup store? | (a) window + Redis nonce + D5 DOP (no schema change); (b) new durable nonce entity (future versioned schema) | **(a)** — no freeze break; D5 DOP is the durable backstop |
| **OD-2** | Inbound-alert audit sink | (a) `system_events` `GatewayEvent` rows (no new enum/table); (b) dedicated structure (future schema) | **(a)** — mirrors B8 DLQ-on-`system_events` precedent |
| **OD-3** | Persist TradingView origin on the `Signal`? | (a) operational audit only (no schema change); (b) add origin column (future versioned schema) | **(a)** for now; **(b)** only via versioned approval |
| **OD-4** | Inbound network surface approval | (a) approve a single webhook receiver (first inbound surface); (b) defer | **(a)** scoped to one POST endpoint, owner-gated |
| **OD-5** | HTTP framework for the receiver | stdlib `http.server` / Flask / FastAPI (no broader API) | defer to implementation review; smallest viable, single endpoint |

These are recorded for the owner; none is implemented by this document.

---

## 14. Definition of Done (requirement 15)

1. A single authenticated HTTPS **webhook receiver** (one POST endpoint) — the only new surface.
2. **HMAC-SHA256** body authentication + optional IP allowlist; secret from env; redacted logs; invalid → 401.
3. **Payload schema** validated; `market`/`engine`/`direction` mapped to existing enums; out-of-domain → 422.
4. **Instrument resolution** via DAL; unknown/inactive → 422 + DLQ; D10 never creates instruments.
5. **Replay protection**: timestamp window + Redis nonce cache + reliance on D5 `DuplicateOrderProtection`; duplicates → idempotent no-op.
6. Valid alerts **translated to candidate `Signal`** (no score/risk fields) and **submitted to the existing pipeline** (D3→D4→D5→D6 unchanged).
7. **Failure handling** per §9; non-destructive; **no auto-retry**; failures dead-lettered (B8); operational records via `system_events` `GatewayEvent`.
8. **Invariants preserved**: PostgreSQL truth · Redis non-authoritative · Score Engine authoritative · Portfolio ⟂ Risk ⟂ Execution · no broker · no IBKR · no API/UI beyond the webhook · no new tables/enums/schema · D1–D9 unmodified.
9. **No secrets** in code/git/logs.
10. Tests cover: auth pass/fail, schema validation, enum-domain rejection, unknown-instrument rejection, replay (window + nonce), duplicate-order backstop, failure→DLQ, and an end-to-end "alert → candidate signal → pipeline" path (mock broker, in-memory DAL default; PostgreSQL behind `DATABASE_URL`).
11. Owner Decisions OD-1…OD-5 resolved before implementation.
12. `D10_BUILD_REPORT.md` produced; stop at the D10 gate.

---

## 15. Out of Scope (deferred / owner-gated)

- Broker connectivity, Interactive Brokers, order routing (D7, owner-gated).
- Any UI/dashboard/REST API beyond the single webhook.
- Outbound TradingView communication, chart data ingestion, or strategy hosting.
- Risk-based sizing (V2-001); strategy/risk/execution rule changes.
- A durable inbound-alert dedup table or `Signal` origin column (future versioned schema decisions OD-1/OD-3).
- Async ingestion / multi-process / HA.

---

## 16. Stop Gate (requirement 16)

**STOP.**

This document is **architecture only** — no code, no tests, no source changes, no schema changes, no modifications to D1–D9. Implementation is forbidden until owner approval.

Await owner review and rulings on **OD-1…OD-5**, plus approval of the single inbound webhook surface, before any D10 implementation begins.
