# THUL-NURAYN v1

US-equities algorithmic trading backend (NASDAQ/NYSE, Long/Short) — Core Swing + Turbo Intraday.
v1 = **FROZEN**. The approved documentation pack is the single source of truth.

## Status: Phase B1 — D1 Foundation

This repository currently contains the **D1 Foundation** only:

- `src/enums/` — the 12 approved enumerations.
- `src/models/` — 17 entity models + 2 bridge models (dataclasses).
- `db/migrations/001_init_schema.sql` — the 19-table schema (UUID PKs, FK `ON DELETE RESTRICT`, enum CHECK constraints, indexes, partition declarations).
- `db/partitions/partition_retention.sql` — monthly RANGE partitions + Hot→Warm→Cold retention.
- `tests/` — D1 unit tests (enums, models, schema expectations).

`src/{config,logging,redis,validation}` are placeholder layers (later phases).
No Scanner / Strategy / Risk / Execution / Portfolio / Broker / API / UI logic exists yet.

## Run tests

```bash
cd thul-nurayn
python3 -m unittest discover -s tests -v
```

Tests are offline (no network, no database). Applying the schema to a live
PostgreSQL is a later phase (B7).

## Gate

B1 stops at its review gate. **B2 (Data Access) must not begin without owner approval.**
