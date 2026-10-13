import sqlite3
import tempfile
import unittest
from pathlib import Path

from src.core.audit_ledger import SQLiteAuditLedger


class SQLiteAuditLedgerTests(unittest.TestCase):
    def test_records_survive_new_instance_and_keep_order(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "audit.sqlite3"
            first = SQLiteAuditLedger(path)
            first.record("device-manager", "system.settings.read", "READY_TO_EXECUTE",
                         action_id="action-1", scope_present=True)
            first.record("device-manager", "system.settings.read", "SUCCESS",
                         action_id="action-1", reason="VERIFIED")
            second = SQLiteAuditLedger(path)
            rows = second.recent(10)
            self.assertEqual([row["status"] for row in rows],
                             ["READY_TO_EXECUTE", "SUCCESS"])
            self.assertEqual(rows[-1]["details"]["action_id"], "action-1")

    def test_sensitive_payloads_are_never_persisted(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "audit.sqlite3"
            ledger = SQLiteAuditLedger(path)
            ledger.record(
                "device-manager", "system.settings.read", "SUCCESS",
                action_id="action-2", scope_present=True,
                approval_token="secret-token", resource_scope="private/scope",
                result_payload="private-result", exception="sensitive-error",
            )
            rendered = str(ledger.recent())
            for secret in ("secret-token", "private/scope", "private-result",
                           "sensitive-error"):
                self.assertNotIn(secret, rendered)

    def test_sqlite_prevents_update_and_delete(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "audit.sqlite3"
            ledger = SQLiteAuditLedger(path)
            ledger.record("device-manager", "system.settings.read", "SUCCESS")
            connection = sqlite3.connect(path)
            try:
                with self.assertRaises(sqlite3.IntegrityError):
                    connection.execute("UPDATE audit_events SET status='TAMPERED'")
                connection.rollback()
                with self.assertRaises(sqlite3.IntegrityError):
                    connection.execute("DELETE FROM audit_events")
                connection.rollback()
            finally:
                connection.close()
            self.assertEqual(ledger.recent()[0]["status"], "SUCCESS")

    def test_limit_is_bounded_and_zero_returns_empty(self):
        with tempfile.TemporaryDirectory() as directory:
            ledger = SQLiteAuditLedger(Path(directory) / "audit.sqlite3")
            for index in range(4):
                ledger.record("entity", "capability", "SUCCESS", action_id=str(index))
            self.assertEqual(len(ledger.recent(2)), 2)
            self.assertEqual(ledger.recent(0), [])


if __name__ == "__main__":
    unittest.main()
