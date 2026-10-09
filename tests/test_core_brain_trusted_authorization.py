import unittest

from src.core.audit_ledger import AuditLedger
from src.core.memory_ledger import MemoryLedger
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.permission_guard import PermissionGuard
from src.core.trusted_permission_service import TrustedPermissionService


def make_brain(service=None):
    brain = MosharrofCoreBrain.__new__(MosharrofCoreBrain)
    brain.permission_guard = PermissionGuard(trusted_permission_service=service)
    brain.memory_ledger = MemoryLedger()
    brain.audit_ledger = AuditLedger()
    return brain


def allow_service():
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
        approval_verifier=lambda capability, entity, token: token == "valid-approval",
    )


class CoreBrainTrustedAuthorizationTests(unittest.TestCase):
    def test_unconfigured_core_entrypoint_denies_and_audits(self):
        brain = make_brain()
        result = brain.authorize_capability_action(
            entity_id="video-maker",
            capability="video.create",
            resource_scope="video/projects/demo",
            approval_token="valid-approval",
        )
        self.assertEqual(result["status"], "DENIED")
        self.assertEqual(result["reason"], "TRUSTED_PERMISSION_SERVICE_NOT_CONFIGURED")
        self.assertEqual(len(brain.audit_ledger.records), 1)
        self.assertEqual(brain.audit_ledger.records[0]["status"], "DENIED")
        self.assertNotIn("valid-approval", repr(brain.audit_ledger.records))

    def test_core_entrypoint_allows_only_after_trusted_checks_and_audits(self):
        brain = make_brain(allow_service())
        result = brain.authorize_capability_action(
            entity_id="video-maker",
            capability="video.create",
            resource_scope="video/projects/demo",
            approval_token="valid-approval",
        )
        self.assertEqual(result["status"], "ALLOWED")
        self.assertEqual(len(brain.audit_ledger.records), 1)
        self.assertEqual(brain.audit_ledger.records[0]["action"], "CAPABILITY_ACTION_ALLOWED")
        self.assertEqual(brain.audit_ledger.records[0]["details"]["capability"], "video.create")

    def test_scope_escape_is_denied_and_audited(self):
        brain = make_brain(allow_service())
        result = brain.authorize_capability_action(
            entity_id="video-maker",
            capability="video.create",
            resource_scope="system/settings",
            approval_token="valid-approval",
        )
        self.assertEqual(result["status"], "DENIED")
        self.assertEqual(len(brain.audit_ledger.records), 1)
        self.assertEqual(brain.audit_ledger.records[0]["action"], "CAPABILITY_ACTION_DENIED")


if __name__ == "__main__":
    unittest.main()
