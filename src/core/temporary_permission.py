"""Task-scoped temporary permissions.

Temporary permissions are audited by the caller and are never allowed to grant
DELETE or destructive operations.
"""
from datetime import datetime, timezone
from typing import Any, Dict
from src.core.permission_guard import PermissionGuard

class TemporaryPermissionManager:
    def __init__(self, guard: PermissionGuard | None = None) -> None:
        self.guard = guard or PermissionGuard()
        self.active: Dict[str, Dict[str, Any]] = {}

    def grant(self, grant_id: str, *, entity_id: str, operation: str, scope: str, task: str) -> Dict[str, Any]:
        decision = self.guard.check(operation, scope=scope, entity_scope=entity_id)
        if decision["status"] == "DENIED":
            return decision
        item = {
            "grant_id": grant_id,
            "entity_id": entity_id,
            "operation": operation.upper(),
            "scope": scope,
            "task": task,
            "granted_at": datetime.now(timezone.utc).isoformat(),
            "status": "ACTIVE",
        }
        self.active[grant_id] = item
        return {"status": "GRANTED", **item}

    def revoke(self, grant_id: str) -> Dict[str, Any]:
        item = self.active.pop(grant_id, None)
        if not item:
            return {"status": "NOT_FOUND", "grant_id": grant_id}
        return {
            **item,
            "status": "REVOKED",
            "revoked_at": datetime.now(timezone.utc).isoformat(),
        }
