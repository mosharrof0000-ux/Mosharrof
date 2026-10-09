import json
import tempfile
import unittest
from pathlib import Path

from src.core.universal_permission_engine import UniversalPermissionEngine


class UniversalPermissionEngineTests(unittest.TestCase):
    def setUp(self):
        self.engine = UniversalPermissionEngine()
        self.kwargs = {
            "entity_id": "video-maker",
            "granted_permissions": ["video.create"],
            "resource_scope": "video/projects/demo",
            "entity_scope": "video/*",
            "provider_ready": True,
            "user_approved": True,
        }

    def test_catalogue_is_large_and_future_oriented(self):
        self.assertGreaterEqual(len(self.engine.list_capabilities()), 100)
        self.assertIn("video.text_to_video", self.engine.list_capabilities())
        self.assertIn("image.generate", self.engine.list_capabilities())
        self.assertIn("quran.research.analyze", self.engine.list_capabilities())

    def test_registered_does_not_mean_granted(self):
        result = self.engine.authorize(
            "video.create", entity_id="video-maker",
            resource_scope="video/projects/demo", entity_scope="video/*",
            provider_ready=True, user_approved=True,
        )
        self.assertEqual(result["status"], "DENIED")
        self.assertEqual(result["reason"], "PERMISSION_NOT_GRANTED")

    def test_explicit_grant_and_all_gates_allow(self):
        result = self.engine.authorize("video.create", **self.kwargs)
        self.assertEqual(result["status"], "ALLOWED")
        self.assertEqual(result["reason"], "ALL_GATES_PASSED")

    def test_unknown_capability_fails_closed(self):
        result = self.engine.authorize("quantum.teleport", **self.kwargs)
        self.assertEqual(result["reason"], "UNKNOWN_CAPABILITY")

    def test_scope_escape_denied(self):
        result = self.engine.authorize(
            "video.create", **{**self.kwargs, "resource_scope": "system/settings"}
        )
        self.assertEqual(result["reason"], "SCOPE_BOUNDARY")

    def test_provider_must_be_ready(self):
        result = self.engine.authorize(
            "video.create", **{**self.kwargs, "provider_ready": False}
        )
        self.assertEqual(result["reason"], "PROVIDER_NOT_READY")

    def test_user_approval_required(self):
        result = self.engine.authorize(
            "video.create", **{**self.kwargs, "user_approved": False}
        )
        self.assertEqual(result["reason"], "USER_APPROVAL_REQUIRED")

    def test_permanent_delete_block_cannot_be_granted_around(self):
        result = self.engine.authorize(
            "video.delete",
            **{**self.kwargs, "granted_permissions": ["video.*"]}
        )
        self.assertEqual(result["reason"], "PERMANENT_SAFETY_BLOCK")

    def test_policy_denial_precedes_grant(self):
        result = self.engine.authorize(
            "video.create", **{**self.kwargs, "policy_ok": False}
        )
        self.assertEqual(result["reason"], "POLICY_DENIED")

    def test_audit_events_are_recorded_and_copied(self):
        self.engine.authorize("video.create", **self.kwargs)
        events = self.engine.audit_events()
        self.assertEqual(len(events), 1)
        events[0]["status"] = "TAMPERED"
        self.assertEqual(self.engine.audit_events()[0]["status"], "ALLOWED")


if __name__ == "__main__":
    unittest.main()
