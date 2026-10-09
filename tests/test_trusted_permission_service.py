import unittest

from src.core.trusted_permission_service import TrustedPermissionService


class TrustedPermissionServiceTests(unittest.TestCase):
    def test_unconfigured_service_denies_by_default(self):
        service = TrustedPermissionService()
        result = service.authorize(
            "video.create",
            entity_id="video-maker",
            resource_scope="video/projects/demo",
        )
        self.assertEqual(result["status"], "DENIED")
        self.assertIn(result["reason"], {"POLICY_DENIED", "SCOPE_BOUNDARY"})

    def test_trusted_resolvers_can_authorize_matching_request(self):
        service = TrustedPermissionService(
            grant_resolver=lambda entity: ["video.create"] if entity == "video-maker" else [],
            scope_resolver=lambda entity: "video/*" if entity == "video-maker" else "",
            policy_evaluator=lambda capability, entity, resource, scope: (
                capability == "video.create"
                and entity == "video-maker"
                and resource.startswith("video/projects/")
                and scope == "video/*"
            ),
            provider_readiness=lambda capability: capability == "video.create",
        )
        result = service.authorize(
            "video.create",
            entity_id="video-maker",
            resource_scope="video/projects/demo",
        )
        self.assertEqual(result["status"], "ALLOWED")
        self.assertEqual(result["reason"], "ALL_GATES_PASSED")

    def test_scope_is_resolved_by_service_not_requester(self):
        service = TrustedPermissionService(
            grant_resolver=lambda entity: ["video.create"],
            scope_resolver=lambda entity: "video/projects/allowed",
            policy_evaluator=lambda *args: True,
            provider_readiness=lambda capability: True,
        )
        result = service.authorize(
            "video.create",
            entity_id="video-maker",
            resource_scope="system/settings",
        )
        self.assertEqual(result["status"], "DENIED")
        self.assertEqual(result["reason"], "SCOPE_BOUNDARY")

    def test_resolver_exception_fails_closed(self):
        def broken_grants(entity):
            raise RuntimeError("grant store unavailable")

        service = TrustedPermissionService(
            grant_resolver=broken_grants,
            scope_resolver=lambda entity: "video/*",
            policy_evaluator=lambda *args: True,
            provider_readiness=lambda capability: True,
        )
        result = service.authorize(
            "video.create",
            entity_id="video-maker",
            resource_scope="video/projects/demo",
        )
        self.assertEqual(result["status"], "DENIED")
        self.assertEqual(result["reason"], "PERMISSION_NOT_GRANTED")

    def test_requester_cannot_supply_grants_or_policy_boolean(self):
        service = TrustedPermissionService()
        with self.assertRaises(TypeError):
            service.authorize(
                "video.create",
                entity_id="video-maker",
                resource_scope="video/projects/demo",
                granted_permissions=["video.*"],
                policy_ok=True,
            )


if __name__ == "__main__":
    unittest.main()
