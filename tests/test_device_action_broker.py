import unittest

from src.core.audit_ledger import AuditLedger
from src.core.device_action_broker import DeviceActionBroker
from src.core.permission_guard import PermissionGuard
from src.core.trusted_permission_service import TrustedPermissionService


class DeviceActionBrokerTests(unittest.TestCase):
    def setUp(self):
        self.audit = []
        self.authorized = []
        self.approved = []
        self.broker = DeviceActionBroker(
            authorize=self.authorize,
            approval_check=self.approval_check,
            audit_sink=self.audit.append,
        )

    def authorize(self, capability, **context):
        self.authorized.append((capability, context))
        return {"status": "ALLOWED", "reason": "ALL_GATES_PASSED"}

    def approval_check(self, action_id, capability, entity_id, scope, token):
        self.approved.append((action_id, capability, entity_id, scope))
        return token == "fresh-approval"

    def run_action(self, **overrides):
        args = {
            "capability": "system.settings.read",
            "entity_id": "device-manager",
            "resource_scope": "system/settings/display",
            "approval_token": "fresh-approval",
            "operation": lambda: {"opened": True},
            "verifier": lambda result: result.get("opened") is True,
            "action_id": "action-123",
        }
        args.update(overrides)
        return self.broker.execute(**args)

    def test_permission_guard_and_audit_ledger_adapter(self):
        ledger = AuditLedger()
        service = TrustedPermissionService(
            grant_resolver=lambda entity: ["system.settings.read"],
            scope_resolver=lambda entity: "system/settings/*",
            policy_evaluator=lambda capability, entity, resource, scope: (
                capability == "system.settings.read"
                and entity == "device-manager"
                and resource == "system/settings/display"
                and scope == "system/settings/*"
            ),
            provider_readiness=lambda capability: True,
            approval_verifier=lambda capability, entity, token: token == "fresh-approval",
        )
        broker = DeviceActionBroker.from_permission_guard(
            permission_guard=PermissionGuard(trusted_permission_service=service),
            approval_check=self.approval_check,
            audit_ledger=ledger,
        )
        result = broker.execute(
            capability="system.settings.read",
            entity_id="device-manager",
            resource_scope="system/settings/display",
            approval_token="fresh-approval",
            operation=lambda: {"opened": True},
            verifier=lambda value: value.get("opened") is True,
            action_id="action-ledger-1",
        )
        self.assertEqual(result["status"], "SUCCESS")
        record = ledger.recent(1)[0]
        self.assertEqual(record["action"], "system.settings.read")
        self.assertEqual(record["status"], "SUCCESS")
        self.assertEqual(record["details"]["action_id"], "action-ledger-1")
        self.assertTrue(record["details"]["scope_present"])
        self.assertNotIn("fresh-approval", str(ledger.recent()))
        self.assertNotIn("system/settings/display", str(ledger.recent()))
        self.assertNotIn("opened", str(ledger.recent()))

    def test_adapter_requires_real_permission_guard_and_audit_ledger(self):
        with self.assertRaises(ValueError):
            DeviceActionBroker.from_permission_guard(
                permission_guard=None,
                approval_check=self.approval_check,
                audit_ledger=AuditLedger(),
            )
        with self.assertRaises(ValueError):
            DeviceActionBroker.from_permission_guard(
                permission_guard=PermissionGuard(),
                approval_check=self.approval_check,
                audit_ledger=None,
            )

    def test_success_requires_fresh_approval_authorization_and_verification(self):
        result = self.run_action()
        self.assertEqual(result["status"], "SUCCESS")
        self.assertTrue(result["verified"])
        self.assertEqual(len(self.authorized), 1)
        self.assertEqual(len(self.approved), 1)
        self.assertEqual(self.audit[-1]["status"], "SUCCESS")

    def test_missing_or_stale_approval_stops_before_authorization(self):
        result = self.run_action(approval_token="old-token")
        self.assertEqual(result["reason"], "FRESH_ACTION_APPROVAL_REQUIRED")
        self.assertEqual(self.authorized, [])

    def test_destructive_capabilities_are_blocked_even_with_approval(self):
        for capability in ("file.delete", "device.factory_reset", "storage.wipe"):
            with self.subTest(capability=capability):
                result = self.run_action(capability=capability)
                self.assertEqual(result["reason"], "PERMANENT_SAFETY_BLOCK")
        self.assertEqual(self.authorized, [])

    def test_authorization_denial_stops_operation(self):
        self.broker = DeviceActionBroker(
            authorize=lambda *a, **k: {"status": "DENIED", "reason": "SCOPE_BOUNDARY"},
            approval_check=self.approval_check,
            audit_sink=self.audit.append,
        )
        called = []
        result = self.run_action(operation=lambda: called.append(True))
        self.assertEqual(result["status"], "DENIED")
        self.assertEqual(called, [])

    def test_failed_operation_is_not_reported_as_success(self):
        def broken():
            raise RuntimeError("do not log this private error")
        result = self.run_action(operation=broken)
        self.assertEqual(result["status"], "FAILED")
        self.assertFalse(result["verified"])
        self.assertNotIn("private error", str(self.audit))

    def test_failed_verification_is_unverified_not_success(self):
        result = self.run_action(verifier=lambda _: False)
        self.assertEqual(result["status"], "UNVERIFIED")
        self.assertFalse(result["verified"])

    def test_audit_excludes_approval_token_and_result_payload(self):
        result = self.run_action(
            operation=lambda: {"private_payload": "do-not-audit"},
            verifier=lambda _: True,
        )
        self.assertEqual(result["status"], "SUCCESS")
        serialized = str(self.audit)
        self.assertNotIn("fresh-approval", serialized)
        self.assertNotIn("do-not-audit", serialized)
        self.assertNotIn("system/settings/display", serialized)

    def test_authorization_exception_fails_closed(self):
        self.broker = DeviceActionBroker(
            authorize=lambda *a, **k: (_ for _ in ()).throw(RuntimeError()),
            approval_check=self.approval_check,
            audit_sink=self.audit.append,
        )
        result = self.run_action()
        self.assertEqual(result["status"], "DENIED")
        self.assertEqual(result["reason"], "AUTHORIZATION_SERVICE_ERROR")

    def test_audit_failure_prevents_success_claim_after_execution(self):
        self.broker = DeviceActionBroker(
            authorize=self.authorize,
            approval_check=self.approval_check,
            audit_sink=lambda _: (_ for _ in ()).throw(RuntimeError()),
        )
        result = self.run_action()
        self.assertEqual(result["status"], "UNVERIFIED")
        self.assertEqual(result["reason"], "AUDIT_WRITE_FAILED_AFTER_ACTION")
        self.assertFalse(result["verified"])


if __name__ == "__main__":
    unittest.main()
