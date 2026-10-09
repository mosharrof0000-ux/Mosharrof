import tempfile
import unittest
from pathlib import Path

from src.core.tool_factory import ToolFactory
from src.core.trusted_permission_service import TrustedPermissionService


def configured_service():
    return TrustedPermissionService(
        grant_resolver=lambda entity: [
            "ai.tool.register", "ai.tool.execute"
        ] if entity == "tool_factory" else [],
        scope_resolver=lambda entity: "tools/*" if entity == "tool_factory" else "",
        policy_evaluator=lambda capability, entity, resource, scope: (
            entity == "tool_factory"
            and resource.startswith("tools/")
            and scope == "tools/*"
            and capability in {"ai.tool.register", "ai.tool.execute"}
        ),
        provider_readiness=lambda capability: capability in {
            "ai.tool.register", "ai.tool.execute"
        },
        approval_verifier=lambda capability, entity, token: (
            entity == "tool_factory" and token == "approved"
        ),
    )


class ToolFactoryTrustedAuthorizationTests(unittest.TestCase):
    def test_default_service_denies_registration_and_execution(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            factory = ToolFactory(temp_dir)
            result = factory.create_tool(
                "echo", "return args[0]", approval_token="approved"
            )
            self.assertTrue(result.startswith("DENIED:"))
            self.assertFalse((Path(temp_dir) / "echo.py").exists())
            execution = factory.execute_tool(
                "echo", "hello", approval_token="approved"
            )
            self.assertEqual(execution["status"], "DENIED")

    def test_registration_and_execution_require_approved_trusted_grants(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            factory = ToolFactory(
                temp_dir, trusted_permission_service=configured_service()
            )
            denied = factory.create_tool("echo", "return args[0]", approval_token="wrong")
            self.assertTrue(denied.startswith("DENIED:"))
            self.assertFalse((Path(temp_dir) / "echo.py").exists())

            created = factory.create_tool(
                "echo", "return args[0]", approval_token="approved"
            )
            self.assertIn("created and registered", created)
            result = factory.execute_tool(
                "echo", "hello", approval_token="approved"
            )
            self.assertEqual(result, "hello")

    def test_existing_modules_are_not_imported_during_initialization(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            tool_path = Path(temp_dir) / "existing.py"
            tool_path.write_text(
                '"""Existing tool."""\ndef run(*args, **kwargs):\n    return "ok"\n',
                encoding="utf-8",
            )
            factory = ToolFactory(
                temp_dir, trusted_permission_service=configured_service()
            )
            self.assertNotIn("existing", factory.registry)
            self.assertEqual(
                factory.execute_tool("existing", approval_token="approved"), "ok"
            )


if __name__ == "__main__":
    unittest.main()
