import json

from src.core.entity_registry import EntityRegistry
from src.core.permission_engine import PermissionEngine
from src.core.policy_engine import PolicyEngine


def test_manifest_and_registry_are_machine_readable():
    with open("PROJECT_MANIFEST.json", encoding="utf-8") as handle:
        manifest = json.load(handle)
    with open("docs/ENTITY_REGISTRY.json", encoding="utf-8") as handle:
        registry = json.load(handle)

    assert manifest["project"]["name"] == "Mosharrof"
    assert manifest["architecture"]["delete_policy"] == "permanently-blocked"
    assert registry["entities"]


def test_delete_is_permanently_denied():
    permission = PermissionEngine()
    policy = PolicyEngine()
    assert permission.authorize("DELETE")["status"] == "DENIED"
    assert policy.check(operation="DELETE", scope="system", entity_scope="system")["allowed"] is False


def test_entity_registry_preserves_scope():
    registry = EntityRegistry()
    registry.register("chat", role="user conversation", brain="chat", scope="conversation")
    assert registry.get("chat")["scope"] == "conversation"
