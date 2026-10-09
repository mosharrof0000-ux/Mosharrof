import unittest

from src.core.permission_guard import PermissionGuard
from src.core.trusted_permission_service import TrustedPermissionService


def trusted_service():
    return TrustedPermissionService(
        grant_resolver=lambda entity: ["video.create"] if entity == "video-maker" else [],
        scope_resolver=lambda entity: "video/*" if entity == "video-maker" else "",
        policy_evaluator=lambda capability, entity, resource, scope: (
            capability == "video.create"
            and entity == "video-maker"
            and resource.startswith("video/projects/")
            and scope == "video/*"
        ),
        provider_readiness=lambda capability: capability == "video.create",
        approval_verifier=lambda capability, entity, token: token == "approved-token",
    )


class PermissionGuardTrustedAdapterTests(unittest.TestCase):
    def test_capability_authorization_fails_closed_when_unconfigured(self):
        guard = PermissionGuard()
        result = guard.authorize_capability(
            "video.create",
            entity_id="video-maker",
            resource_scope="video/projects/demo",
            approval_token="approved-token",
        )
        self.assertEqual(result["status"], "DENIED")
        self.assertEqual(result["reason"], "TRUSTED_PERMISSION_SERVICE_NOT_CONFIGURED")

    def test_capability_authorization_delegates_to_trusted_service(self):
        guard = PermissionGuard(trusted_permission_service=trusted_service())
        result = guard.authorize_capability(
            "video.create",
            entity_id="video-maker",
            resource_scope="video/projects/demo",
            approval_token="approved-token",
        )
        self.assertEqual(result["status"], "ALLOWED")
        self.assertEqual(result["reason"], "ALL_GATES_PASSED")

    def test_capability_scope_escape_is_denied(self):
        guard = PermissionGuard(trusted_permission_service=trusted_service())
        result = guard.authorize_capability(
            "video.create",
            entity_id="video-maker",
            resource_scope="system/settings",
            approval_token="approved-token",
        )
        self.assertEqual(result["status"], "DENIED")
        self.assertEqual(result["reason"], "POLICY_DENIED")

    def test_destructive_capability_remains_blocked(self):
        guard = PermissionGuard(trusted_permission_service=trusted_service())
        result = guard.authorize_capability(
            "video.create",
            entity_id="video-maker",
            resource_scope="video/projects/demo",
            approval_token="approved-token",
            destructive=True,
        )
        self.assertEqual(result["status"], "DENIED")
        self.assertEqual(result["reason"], "PERMANENT_SAFETY_BLOCK")

    def test_legacy_check_contract_is_preserved(self):
        guard = PermissionGuard(profile="chat")
        self.assertEqual(
            guard.check("MESSAGE", scope="chat", entity_scope="chat")["status"],
            "ALLOWED",
        )
        self.assertEqual(
            guard.check("WRITE", scope="chat", entity_scope="chat")["status"],
            "DENIED",
        )


if __name__ == "__main__":
    unittest.main()
