import unittest

from src.core.device_action_broker import DeviceActionBroker


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
            "capability": "settings.open_page",
            "entity_id": "device-manager",
            "resource_scope": "device/settings/display",
            "approval_token": "fresh-approval",
            "operation": lambda: {"opened": True},
            "verifier": lambda result: result.get("opened") is True,
            "action_id": "action-123",
        }
        args.update(overrides)
        return self.broker.execute(**args)

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
        )
        self.assertEqual(result["status"], "SUCCESS")
        serialized = str(self.audit)
        self.assertNotIn("fresh-approval", serialized)
        self.assertNotIn("do-not-audit", serialized)

    def test_authorization_exception_fails_closed(self):
        self.broker = DeviceActionBroker(
            authorize=lambda *a, **k: (_ for _ in ()).throw(RuntimeError()),
            approval_check=self.approval_check,
            audit_sink=self.audit.append,
        )
        result = self.run_action()
        self.assertEqual(result["status"], "DENIED")
        self.assertEqual(result["reason"], "AUTHORIZATION_SERVICE_ERROR")


if __name__ == "__main__":
    unittest.main()
