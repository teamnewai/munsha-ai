# THUL-NURAYN v1 — Foundation (D1)

The foundation layer of THUL-NURAYN v1, a quantitative trading system.
**FROZEN scope** — this directory contains *foundation only*: data structures
and infrastructure, **no** scanner / ranking / score / risk / execution /
portfolio **logic** (those are phases D2–D9).

> ⚠️ The authoritative `THUL-NURAYN_v1_MASTER_SPECIFICATION.md` and Phase
> 4A/4B/4C documents were not present when D1 was built. This foundation was
> built from the D1 task brief with conservative, documented assumptions —
> see `../docs/CHANGE_REQUESTS/CR-001.md` and `../D1_FOUNDATION_REPORT.md`.

## Layout

```
thul_nurayn/
├── config/            # Configuration layer (env-driven, frozen dataclasses)
├── logging/           # Logging layer (structured JSON, stdlib-based)
├── domain/
│   ├── enums.py       # 8 shared enumerations
│   └── models.py      # 17 core domain models (+ 2 junction records)
├── validation/        # Validation layer (dependency-free)
├── redis/             # Redis operational layer (cache/events/queues/DLQ/health/state)
├── db/migrations/     # PostgreSQL = source of truth (ordered .sql)
└── tests/             # Unit tests (pytest)
```

## Architectural invariants

- **PostgreSQL is the source of truth** (durable state, defined by `db/migrations`).
- **Redis is non-persistent / operational** (cache, queues, DLQ, health, state).
- **Fail-safe** risk defaults (`RiskCheck` → `REJECTED` unless explicitly approved).

## Quick start

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt        # just pytest + pytest-cov
python -m pytest                            # 58 tests, ~95% source coverage
```

The core layers are **pure standard library** — the unit tests need no
database or Redis server (Redis uses an in-memory backend; the schema is
tested structurally). A live deployment adds `redis` and `psycopg`
(`pip install -e ".[live]"`).

## Database

See `db/migrations/README.md`. Apply migrations in lexical order against a
PostgreSQL ≥ 12 instance. The D1 schema was validated end-to-end against
PostgreSQL 16 (all 12 migrations apply; 19 entities, 8 enum types, 4
partitioned tables, retention/archival functions all verified).
