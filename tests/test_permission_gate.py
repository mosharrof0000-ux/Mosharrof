from src.core.permission_gate import PermissionGate


def test_delete_is_always_denied():
    gate = PermissionGate()
    assert gate.check("DELETE").allowed is False
    assert gate.check("DELETE").reason == "DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED"


def test_non_destructive_capability_can_be_allowed():
    assert PermissionGate().check("READ").allowed is True
