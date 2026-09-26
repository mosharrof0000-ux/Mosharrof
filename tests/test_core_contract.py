import pytest

from src.core.permission_guard import PermissionDenied, PermissionGuard


def test_delete_is_permanently_denied():
    guard = PermissionGuard()
    result = guard.check("DELETE")
    assert result["status"] == "DENIED"
    assert result["reason"] == "DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED"
    with pytest.raises(PermissionDenied):
        guard.require("DELETE")


def test_scope_boundary_is_enforced():
    guard = PermissionGuard()
    assert guard.check("READ", scope="core/tools", entity_scope="core")["status"] == "ALLOWED"
    assert guard.check("READ", scope="quran", entity_scope="core")["status"] == "DENIED"


def test_non_destructive_operation_is_allowed():
    guard = PermissionGuard()
    assert guard.check("READ")["status"] == "ALLOWED"
    assert guard.check("CREATE_TOOL")["status"] == "ALLOWED"
