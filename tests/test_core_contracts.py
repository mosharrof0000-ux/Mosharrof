import json

import pytest

from src.core.entity_registry import EntityRegistry
from src.core.permission_guard import PermissionGuard
from src.core.project_manifest import ProjectManifest


def test_manifest_and_entity_registry_are_machine_readable():
    manifest = ProjectManifest()
    registry = EntityRegistry()

    assert manifest.project_id == "mosharrof"
    assert manifest.project_name == "Mosharrof"
    assert registry.get("mosharrof.core")["permission_profile"] == "core"


def test_delete_and_destructive_operations_are_always_denied():
    guard = PermissionGuard(profile="core", allowed={"READ", "UPDATE", "EXECUTE"})

    assert guard.check("DELETE")["status"] == "DENIED"
    assert guard.check("UPDATE", destructive=True)["status"] == "DENIED"


def test_out_of_scope_operation_is_denied():
    guard = PermissionGuard(profile="domain_read", allowed={"READ", "ANALYZE"})

    assert guard.check("EXECUTE")["status"] == "DENIED"
    assert guard.check("ANALYZE")["status"] == "ALLOWED"


def test_manifest_is_valid_json():
    data = json.loads(open("config/project_manifest.json", encoding="utf-8").read())
    assert data["schema_version"] == "1.0.0"
