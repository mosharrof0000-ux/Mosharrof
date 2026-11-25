"""Automated tests for configuration manifest integrity."""

import json
from pathlib import Path

CONFIG_DIR = Path(__file__).resolve().parents[1] / "config"


def test_config_json_files_are_valid():
    json_files = list(CONFIG_DIR.glob("*.json"))
    assert len(json_files) > 0, "Config directory should contain JSON files"
    for json_file in json_files:
        content = json_file.read_text(encoding="utf-8")
        data = json.loads(content)
        assert isinstance(data, dict), f"{json_file.name} must be a JSON object"


def test_project_manifest_structure():
    manifest_path = CONFIG_DIR / "project_manifest.json"
    assert manifest_path.is_file(), "project_manifest.json must exist"
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert "schema_version" in data
    assert "project_id" in data
    assert data["project_id"] == "mosharrof.core"
    assert data["immutable_safety_rules"]["delete"] is False


def test_entity_and_capability_registries_structure():
    entity_reg_path = CONFIG_DIR / "entity_registry.json"
    assert entity_reg_path.is_file(), "entity_registry.json must exist"
    entity_data = json.loads(entity_reg_path.read_text(encoding="utf-8"))
    assert "schema_version" in entity_data
    assert "entities" in entity_data
    assert len(entity_data["entities"]) > 0

    cap_reg_path = CONFIG_DIR / "capability_registry.json"
    assert cap_reg_path.is_file(), "capability_registry.json must exist"
    cap_data = json.loads(cap_reg_path.read_text(encoding="utf-8"))
    assert cap_data["defaults"]["permanent_delete_block"] is True
    assert "categories" in cap_data


def test_entity_registry_integrity():
    entity_reg_path = CONFIG_DIR / "entity_registry.json"
    entity_data = json.loads(entity_reg_path.read_text(encoding="utf-8"))
    for entity in entity_data["entities"]:
        assert "id" in entity
        assert "brain" in entity
        assert "scope" in entity


def test_autonomous_policy_safety_invariants():
    auto_policy_path = CONFIG_DIR / "autonomous_policy.json"
    assert auto_policy_path.is_file(), "autonomous_policy.json must exist"
    data = json.loads(auto_policy_path.read_text(encoding="utf-8"))
    permanent = data["permanent"]
    assert permanent["delete_allowed"] is False
    assert permanent["destructive_operations_allowed"] is False
    assert permanent["direct_main_write_allowed"] is False
    assert permanent["force_push_allowed"] is False
    assert set(data["autonomous"]["allowed_paths"]) == {
        "web/", "src/", "backend/", "tests/", "config/", "docs/"
    }


def test_permission_profiles_deny_destructive_operations():
    profiles_path = CONFIG_DIR / "permission_profiles.json"
    assert profiles_path.is_file(), "permission_profiles.json must exist"
    data = json.loads(profiles_path.read_text(encoding="utf-8"))
    for name, profile in data["profiles"].items():
        denied = set(profile.get("deny", []))
        assert "delete" in denied, f"Profile {name} must deny delete"
        assert "destructive" in denied, f"Profile {name} must deny destructive"


def test_global_policy_safety_rules():
    policy_path = CONFIG_DIR / "policy.json"
