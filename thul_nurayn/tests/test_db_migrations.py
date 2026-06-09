"""Structural tests for the SQL migration manifest.

These assert the foundation's schema *surface* (entities, partitioned tables,
enum types, junctions) without requiring a live PostgreSQL server.
"""

from thul_nurayn.db import migration_files

ENTITIES = [
    "users", "sectors", "instruments", "market_snapshots", "scanner_results",
    "signals", "scores", "risk_checks", "orders", "fills", "positions",
    "risk_snapshots", "news_events", "earnings_events", "performance_records",
    "audit_logs", "system_events", "signal_news", "signal_earnings",
]
ENUM_TYPES = [
    "market_regime", "engine_type", "direction", "order_status",
    "position_status", "user_role", "risk_decision", "severity_level",
]
PARTITIONED = ["market_snapshots", "risk_snapshots", "audit_logs", "system_events"]


def _all_sql() -> str:
    return "\n".join(p.read_text() for p in migration_files()).lower()


def test_migrations_present_and_ordered():
    files = migration_files()
    names = [p.name for p in files]
    assert names == sorted(names)
    assert len(files) >= 12


def test_all_19_entities_created():
    sql = _all_sql()
    for entity in ENTITIES:
        assert f"create table if not exists {entity} " in sql, entity


def test_all_8_enum_types_created():
    sql = _all_sql()
    for enum_name in ENUM_TYPES:
        assert f"create type {enum_name} as enum" in sql, enum_name


def test_partitioned_tables_use_range_partitioning():
    sql = _all_sql()
    for table in PARTITIONED:
        assert f"create table if not exists {table} " in sql
    assert sql.count("partition by range") == len(PARTITIONED)


def test_retention_and_archival_structure():
    sql = _all_sql()
    assert "create schema if not exists archive" in sql
    assert "retention_policies" in sql
    assert "tn_apply_retention" in sql


def test_failsafe_default_on_risk_checks():
    sql = _all_sql()
    assert "decision    risk_decision not null default 'rejected'" in sql
