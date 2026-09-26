"""Task-scoped temporary permissions with append-only audit records."""

from datetime import datetime, timezone
from typing import Any, Dict
from src.core.permission_guard import PermissionGuard
from src.core.audit_ledger import AuditLedger


class TemporaryPermissionManager:
    def __init__(self, guard: PermissionGuard | None = None, audit_ledger: AuditLedger | None = None) -> None:
        self.guard = guard or PermissionGuard()
        self.audit = audit_ledger or AuditLedger()
        self.active: Dict[str, Dict[str, Any]] = {}

    def grant(self, grant_id: str, *, entity_id: str, operation: str, scope: str, task: str) -> Dict[str, Any]:
        decision = self.guard.check(operation, scope=scope, entity_scope=entity_id)
        if decision["status"] == "DENIED":
            self.audit.record(entity_id, "TEMP_PERMISSION_GRANT", "DENIED",
                              grant_id=grant_id, operation=operation.upper(),
                              scope=scope, reason=decision["reason"])
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
        self.audit.record(entity_id, "TEMP_PERMISSION_GRANT", "GRANTED",
                          grant_id=grant_id, operation=item["operation"], scope=scope, task=task)
        return {**item, "status": "GRANTED"}

    def revoke(self, grant_id: str) -> Dict[str, Any]:
        item = self.active.pop(grant_id, None)
        if not item:
            return {"status": "NOT_FOUND", "grant_id": grant_id}
        result = {
            **item,
            "status": "REVOKED",
            "revoked_at": datetime.now(timezone.utc).isoformat(),
        }
        self.audit.record(item["entity_id"], "TEMP_PERMISSION_REVOKE", "REVOKED",
                          grant_id=grant_id, operation=item["operation"], scope=item["scope"])
        return result

    def complete_task(self, grant_id: str) -> Dict[str, Any]:
        return self.revoke(grant_id)
