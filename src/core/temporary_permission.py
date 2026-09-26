"""Task-scoped temporary permissions.

DELETE and destructive operations are never grantable, even temporarily.
"""
from datetime import datetime, timezone
from typing import Any, Dict
from src.core.permission_guard import PermissionGuard

class TemporaryPermissionManager:
    def __init__(self, guard: PermissionGuard | None = None) -> None:
        self.guard = guard or PermissionGuard()
        self.active: Dict[str, Dict[str, Any]] = {}

    def grant(self, grant_id: str, *, entity_id: str, operation: str, scope: str, task: str) -> Dict[str, Any]:
        check = self.guard.check(operation, scope=scope, entity_scope=entity_id)
        if check["status"] == "DENIED":
            return check
        item = {
            "grant_id": grant_id,
            "entity_id": entity_id,
            "operation": operation.upper(),
            "scope": scope,
            "task": task,
            "granted_at": datetime.now(timezone.utc).isoformat(),
            "status": "ACTIVE"
        }
        self.active[grant_id] = item
        return {"status": "GRANTED", **item}

    def revoke(self, grant_id: str) -> Dict[str, Any]:
        item = self.active.get(grant_id)
        if not item:
            return {"status": "NOT_FOUND", "grant_id": grant_id}
        item = {**item, "status": "REVOKED", "revoked_at": datetime.now(timezone.utc).isoformat()}
        self.active.pop(grant_id, None)
        return item
