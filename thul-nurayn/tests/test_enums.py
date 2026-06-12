"""D1 unit tests — enum integrity.

Verifies each of the 12 enumerations exposes exactly its specified members
(no extras, no omissions) and that member values match the spellings used by
the database CHECK constraints. No network, no DB.
"""

import unittest

from src import enums


class TestEnumMembers(unittest.TestCase):
    """Each enum must contain exactly its approved member value set."""

    EXPECTED = {
        "MarketRegime": {"Bull", "Bear", "Sideways"},
        "EngineType": {"Core", "Turbo"},
        "Direction": {"Long", "Short"},
        "OrderStatus": {"New", "Sent", "Filled", "Rejected", "Cancelled"},
        "PositionStatus": {"Open", "Closed"},
        "UserRole": {"Owner", "Operator", "Viewer"},
        "RiskDecision": {"Accepted", "Rejected"},
        "SeverityLevel": {"Warning", "Critical", "Emergency"},
        "TradeClassification": {"UltraGolden", "Golden", "Strong", "Watchlist"},
        "Market": {"NASDAQ", "NYSE"},
        "SystemEventType": {
            "ServiceStarted", "ServiceStopped", "WorkerFailure",
            "RedisEvent", "PostgresEvent", "GatewayEvent",
            "KillSwitchActivated", "IBGatewayReconnected",
        },
        "AuditEventType": {
            "Login", "SettingRiskChange", "Order", "Shutdown", "Error",
        },
    }

    def test_all_expected_enums_exist(self):
        for name in self.EXPECTED:
            self.assertTrue(hasattr(enums, name), f"missing enum: {name}")

    def test_exactly_twelve_enums_exported(self):
        self.assertEqual(len(enums.__all__), 12)
        self.assertEqual(set(enums.__all__), set(self.EXPECTED.keys()))

    def test_member_value_sets_match_exactly(self):
        for name, expected in self.EXPECTED.items():
            enum_cls = getattr(enums, name)
            actual = {m.value for m in enum_cls}
            self.assertEqual(
                actual, expected,
                f"{name} members {actual} != expected {expected}",
            )

    def test_members_are_str_valued(self):
        for name in self.EXPECTED:
            enum_cls = getattr(enums, name)
            for member in enum_cls:
                self.assertIsInstance(member.value, str)
                # str-Enum: the member is itself a str
                self.assertIsInstance(member, str)

    def test_no_duplicate_values_within_enum(self):
        for name in self.EXPECTED:
            enum_cls = getattr(enums, name)
            values = [m.value for m in enum_cls]
            self.assertEqual(len(values), len(set(values)), f"{name} has duplicates")


if __name__ == "__main__":
    unittest.main()
