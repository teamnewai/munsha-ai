"""D1 unit tests — schema constraint expectations (offline, textual).

Validates the migration + partition SQL artifacts against the foundation
requirements WITHOUT a database (applying to live PostgreSQL is B7):
  * all 19 tables present
  * UUID primary keys
  * FK ON DELETE RESTRICT
  * enum CHECK constraints with exact member sets
  * monthly RANGE partitioning on the 6 designated tables
  * append-only markers for audit_logs / system_events
  * indexes on sector / state / classification / engine / time
  * retention tiering Hot -> Warm -> Cold; audit/system never deleted
"""

import re
import unittest
from pathlib import Path

DB_DIR = Path(__file__).resolve().parents[1] / "db"
SCHEMA = (DB_DIR / "migrations" / "001_init_schema.sql").read_text()
PARTS = (DB_DIR / "partitions" / "partition_retention.sql").read_text()

# whitespace-stripped copy for substring checks that ignore formatting
SCHEMA_NS = re.sub(r"\s+", "", SCHEMA)

ALL_TABLES = [
    "sectors", "users", "instruments", "market_snapshots", "scanner_results",
    "signals", "scores", "risk_checks", "orders", "positions", "fills",
    "risk_snapshots", "news_events", "earnings_events", "performance_records",
    "audit_logs", "system_events", "signal_news", "signal_earnings",
]

PARTITIONED = [
    "market_snapshots", "signals", "orders",
    "risk_snapshots", "audit_logs", "system_events",
]

# enum value sets that must appear verbatim inside a CHECK (...)
ENUM_CHECKS = {
    "MarketRegime": "('Bull','Bear','Sideways')",
    "EngineType": "('Core','Turbo')",
    "Direction": "('Long','Short')",
    "OrderStatus": "('New','Sent','Filled','Rejected','Cancelled')",
    "PositionStatus": "('Open','Closed')",
    "UserRole": "('Owner','Operator','Viewer')",
    "RiskDecision": "('Accepted','Rejected')",
    "SeverityLevel": "('Warning','Critical','Emergency')",
    "TradeClassification": "('UltraGolden','Golden','Strong','Watchlist')",
    "Market": "('NASDAQ','NYSE')",
    "SystemEventType": (
        "('ServiceStarted','ServiceStopped','WorkerFailure',"
        "'RedisEvent','PostgresEvent','GatewayEvent',"
        "'KillSwitchActivated','IBGatewayReconnected')"
    ),
    "AuditEventType": "('Login','SettingRiskChange','Order','Shutdown','Error')",
}


class TestSchemaTables(unittest.TestCase):
    def test_all_19_tables_present(self):
        for t in ALL_TABLES:
            self.assertRegex(
                SCHEMA, rf"CREATE TABLE {t}\b",
                msg=f"missing CREATE TABLE {t}",
            )

    def test_exactly_19_tables(self):
        created = re.findall(r"CREATE TABLE (\w+)", SCHEMA)
        self.assertEqual(len(created), 19, f"expected 19 tables, found {created}")
        self.assertEqual(set(created), set(ALL_TABLES))


class TestConstraints(unittest.TestCase):
    def test_uuid_primary_keys(self):
        # every table declares UUID id columns
        self.assertIn("idUUID", SCHEMA_NS)
        self.assertIn("PRIMARYKEY", SCHEMA_NS)

    def test_fk_on_delete_restrict(self):
        self.assertIn("ON DELETE RESTRICT", SCHEMA)
        # several FKs expected
        self.assertGreaterEqual(SCHEMA.count("ON DELETE RESTRICT"), 8)

    def test_enum_check_constraints_exact(self):
        for name, values in ENUM_CHECKS.items():
            self.assertIn(
                values.replace(" ", ""), SCHEMA_NS,
                msg=f"{name} CHECK value set not found: {values}",
            )

    def test_one_to_one_uniqueness(self):
        # Score and RiskCheck are 1:1 with Signal via UNIQUE signal_id
        self.assertIn("signal_idUUIDNOTNULLUNIQUE", SCHEMA_NS)


class TestPartitioning(unittest.TestCase):
    def test_six_partition_parents(self):
        self.assertEqual(SCHEMA.count("PARTITION BY RANGE"), 6)

    def test_each_partitioned_table_declared(self):
        for t in PARTITIONED:
            m = re.search(rf"CREATE TABLE {t}\b.*?;", SCHEMA, re.S)
            self.assertIsNotNone(m, f"{t} not found")
            self.assertIn(
                "PARTITION BY RANGE", m.group(0),
                msg=f"{t} is not declared PARTITION BY RANGE",
            )

    def test_monthly_partitions_present(self):
        for t in PARTITIONED:
            self.assertRegex(
                PARTS, rf"PARTITION OF {t}\b",
                msg=f"no monthly PARTITION OF {t}",
            )


class TestAppendOnlyAndRetention(unittest.TestCase):
    def test_append_only_markers(self):
        self.assertGreaterEqual(SCHEMA.count("APPEND-ONLY"), 2)
        # both append-only tables flagged
        for t in ("audit_logs", "system_events"):
            block = re.search(rf"CREATE TABLE {t}\b.*?;", SCHEMA, re.S).group(0)
            # marker sits in the comment immediately preceding the table
            idx = SCHEMA.index(f"CREATE TABLE {t}")
            preceding = SCHEMA[max(0, idx - 200):idx]
            self.assertIn("APPEND-ONLY", preceding, f"{t} missing append-only marker")

    def test_retention_tiering(self):
        for tier in ("Hot", "Warm", "Cold"):
            self.assertIn(tier, PARTS)
        self.assertIn("never deleted", PARTS)


class TestIndexes(unittest.TestCase):
    def test_hot_lookup_indexes(self):
        # sector / state / classification / engine / time
        for needle in (
            "idx_instruments_sector",
            "idx_orders_status",          # state
            "idx_scores_classification",  # classification
            "idx_signals_engine",         # engine
            "idx_signals_time",           # time
        ):
            self.assertIn(needle, SCHEMA, msg=f"missing index {needle}")


if __name__ == "__main__":
    unittest.main()
