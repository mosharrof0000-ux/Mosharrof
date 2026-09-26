"""Validate the machine-readable Mosharrof foundation without mutating project files."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / "config/project_manifest.json").read_text(encoding="utf-8"))
registry = json.loads((ROOT / "config/entity_registry.json").read_text(encoding="utf-8"))

assert manifest["project_id"] == "mosharrof.core"
assert manifest["owner"] == "Mosharrof Karim"
assert manifest["immutable_safety_rules"]["delete"] is False
assert manifest["immutable_safety_rules"]["destructive_operations"] is False

entities = registry["entities"]
ids = [item["id"] for item in entities]
assert len(ids) == len(set(ids)), "Entity IDs must be unique"

for entity in entities:
    entity_id = entity["id"]
    entity_file = ROOT / "entities" / entity_id / "ENTITY.json"
    assert entity_file.exists(), f"Missing entity file: {entity_file}"
    disk_entity = json.loads(entity_file.read_text(encoding="utf-8"))
    assert disk_entity["id"] == entity_id
    assert disk_entity["delete_allowed"] is False
    assert disk_entity["scope"] == f"{entity_id}/*"
    assert entity["scope"] == disk_entity["scope"]

print(f"Architecture validation passed: {len(entities)} entities registered.")
