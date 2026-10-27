"""Permission-profile contract tests for the entity registry."""
import json
from pathlib import Path


def test_all_entities_have_valid_permission_profile():
    registry = json.loads(Path("config/entity_registry.json").read_text(encoding="utf-8"))
    profiles = json.loads(Path("config/permission_profiles.json").read_text(encoding="utf-8"))["profiles"]
    for entity in registry["entities"]:
        assert "permission_profile" in entity
        assert entity["permission_profile"] in profiles
