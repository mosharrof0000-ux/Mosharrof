import json
from pathlib import Path

from src.core.model_adapter import DeterministicAdapter, ModelAdapter
from src.core.permission_guard import PermissionGuard
from src.core.project_manifest import ProjectManifest
from src.core.entity_registry import EntityRegistry


def test_manifest_and_registry_are_machine_readable():
    root = Path(__file__).resolve().parents[1]
    manifest = json.loads((root / "config/project_manifest.json").read_text(encoding="utf-8"))
    registry = json.loads((root / "config/entity_registry.json").read_text(encoding="utf-8"))

    assert manifest["project_id"] == "mosharrof.core"
    assert manifest["owner"] == "Mosharrof Karim"
    assert manifest["immutable_safety_rules"]["delete"] is False
    assert manifest["immutable_safety_rules"]["destructive_operations"] is False

    entities = registry["entities"]
    assert entities
    assert len({entity["id"] for entity in entities}) == len(entities)

    for entity in entities:
        entity_id = entity["id"]
        assert entity["delete_allowed"] is False
        assert entity["scope"] == f"{entity_id}/*"

        entity_file = root / "entities" / entity_id / "ENTITY.json"
        assert entity_file.exists(), f"Missing entity file: {entity_file}"
        entity_data = json.loads(entity_file.read_text(encoding="utf-8"))
        assert entity_data["id"] == entity_id
        assert entity_data["scope"] == entity["scope"]
        assert entity_data["delete_allowed"] is False


def test_manifest_and_registry_loaders():
    manifest = ProjectManifest()
    registry = EntityRegistry()
    assert manifest.project_id == "mosharrof.core"
    assert manifest.project_name == "Mosharrof"
    assert registry.get("core")["delete_allowed"] is False
    assert registry.get("quran_research")["scope"] == "quran_research/*"


def test_model_adapter_contract():
    adapter = DeterministicAdapter()
    assert isinstance(adapter, ModelAdapter)
    assert adapter.generate([{"role": "user", "content": "hello"}])["status"] == "OK"


def test_permission_scope_and_delete_boundary():
    guard = PermissionGuard()
    assert guard.check("READ", scope="chat", entity_scope="chat")["status"] == "ALLOWED"
    assert guard.check("WRITE", scope="core", entity_scope="chat")["status"] == "DENIED"
    assert guard.check("DELETE", scope="chat", entity_scope="chat")["status"] == "DENIED"
    assert guard.check("PROCESS", scope="chat", entity_scope="chat", destructive=True)["status"] == "DENIED"
