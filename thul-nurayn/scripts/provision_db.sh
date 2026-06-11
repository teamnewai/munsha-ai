#!/usr/bin/env bash
# ============================================================================
# THUL-NURAYN v1 — OR-3 PostgreSQL provisioning (idempotent).
# ============================================================================
# Starts the local PostgreSQL cluster, creates the role + database, applies the
# schema, the monthly partitions (committed 2026-06 set + the current and next
# calendar month so inserts at "now" always land in a partition), and the seed.
# Re-runnable: the public schema is reset before the schema is re-applied.
#
# Usage:  scripts/provision_db.sh
# Emits:  DATABASE_URL on stdout (also exportable by the caller).
# ============================================================================
set -euo pipefail

DB="${THUL_DB:-thul_nurayn}"
ROLE="${THUL_ROLE:-thul}"
PASS="${THUL_PASS:-thul}"
HOST="${THUL_HOST:-localhost}"
PORT="${THUL_PORT:-5432}"
DATABASE_URL="postgresql://${ROLE}:${PASS}@${HOST}:${PORT}/${DB}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PSQL_SU() { su postgres -c "psql -v ON_ERROR_STOP=1 $*"; }

# 1) start the cluster (idempotent).
pg_ctlcluster 16 main start >/dev/null 2>&1 || true
for _ in $(seq 1 30); do pg_isready -h "$HOST" -p "$PORT" >/dev/null 2>&1 && break; sleep 1; done

# 2) role + database (idempotent).
PSQL_SU "-tc \"SELECT 1 FROM pg_roles WHERE rolname='${ROLE}'\"" | grep -q 1 \
  || PSQL_SU "-c \"CREATE ROLE ${ROLE} LOGIN PASSWORD '${PASS}';\""
PSQL_SU "-tc \"SELECT 1 FROM pg_database WHERE datname='${DB}'\"" | grep -q 1 \
  || PSQL_SU "-c \"CREATE DATABASE ${DB} OWNER ${ROLE};\""

# 3) reset public schema (idempotent re-apply), then apply schema.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public AUTHORIZATION ${ROLE};"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/db/migrations/001_init_schema.sql"

# 4) partitions: committed set + current and next calendar month (robust to "now").
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/db/partitions/partition_retention.sql" || true
for OFFSET in 0 1; do
  YM=$(date -u -d "${OFFSET} month" +%Y%m)
  START=$(date -u -d "$(date -u +%Y-%m-01) +${OFFSET} month" +%Y-%m-01)
  END=$(date -u -d "$(date -u +%Y-%m-01) +$((OFFSET + 1)) month" +%Y-%m-01)
  for T in market_snapshots signals orders risk_snapshots audit_logs system_events; do
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
      "CREATE TABLE IF NOT EXISTS ${T}_p${YM} PARTITION OF ${T} \
       FOR VALUES FROM ('${START} 00:00:00+00') TO ('${END} 00:00:00+00');"
  done
done

# 5) seed required baseline data.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT/db/seeds/001_seed.sql"

echo "$DATABASE_URL"
