"""Backward-compatible permission engine backed by the single core guard."""
from src.core.permission_guard import PermissionGuard


class PermissionEngine(PermissionGuard):
    """Compatibility facade; all capability decisions use PermissionGuard."""

    def authorize(self, operation, *, scope="", policy_ok=True):
        if not policy_ok:
            return {"status": "DENIED", "operation": (operation or "").upper(), "scope": scope, "reason": "POLICY_DENIED"}
        return self.check(operation, scope=scope, entity_scope=scope)
