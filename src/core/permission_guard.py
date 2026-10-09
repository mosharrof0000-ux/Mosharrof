"""Central capability guard for Mosharrof entity boundaries.

Model intelligence never grants authority by itself. Identity, permission,
policy and scope remain the capability boundary. DELETE/destructive operations
are permanently denied.
"""
from typing import Any

from src.core.trusted_permission_service import TrustedPermissionService


class PermissionGuard:
    BLOCKED_OPERATIONS = {
        "DELETE", "DELETE_FILE", "DELETE_DIRECTORY", "DESTRUCTIVE",
        "DESTROY", "DESTROY_PROJECT", "PURGE", "DROP", "DROP_DATABASE",
        "ERASE", "REMOVE"
    }

    DEFAULT_PERMISSIONS = {
        "core": {"READ", "WRITE", "EXECUTE", "COORDINATE", "REGISTER", "AUDIT"},
        "chat": {"READ", "MESSAGE"},
        "ui": {"READ", "RENDER"},
        "voice": {"READ", "PROCESS"},
        "storage": {"READ", "ORGANIZE"},
        "tool_factory": {"READ", "CREATE_TOOL", "EXECUTE_TOOL"},
        "quran_research": {"READ", "RESEARCH"},
    }

    def __init__(
        self,
        profile: str = "core",
        allowed=(),
        *,
        trusted_permission_service: TrustedPermissionService | None = None,
    ):
        self.profile = profile
        self.allowed = {str(item).strip().upper() for item in allowed}
        self.trusted_permission_service = trusted_permission_service

    def check(self, operation: str, *, scope: str = "entity",
              entity_scope: str = "", destructive: bool = False):
        """Legacy operation check; retained for backward compatibility."""
        op = (operation or "").strip().upper()
        entity = (entity_scope or "").strip().lower()

        if destructive or op in self.BLOCKED_OPERATIONS:
            return {"status": "DENIED", "operation": op, "scope": scope,
                    "reason": "DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED"}

        if self.allowed and op not in self.allowed:
            return {"status": "DENIED", "operation": op, "scope": scope,
                    "reason": "OPERATION_NOT_IN_PERMISSION_SCOPE"}

        if entity in self.DEFAULT_PERMISSIONS and op not in self.DEFAULT_PERMISSIONS[entity]:
            return {"status": "DENIED", "operation": op, "scope": scope,
                    "reason": "OPERATION_NOT_IN_ENTITY_PERMISSION"}

        if entity and scope and not (scope == entity or scope.startswith(entity + "/")):
            return {"status": "DENIED", "operation": op, "scope": scope,
                    "reason": "SCOPE_BOUNDARY"}

        return {"status": "ALLOWED", "operation": op, "scope": scope}

    def authorize_capability(
        self,
        capability: str,
        *,
        entity_id: str,
        resource_scope: str,
        approval_token: Any = None,
        destructive: bool = False,
    ) -> dict[str, Any]:
        """Authorize a registry capability through trusted server-owned context.

        This method deliberately fails closed if the trusted service has not
        been configured. Existing callers of check() keep their old contract;
        security-sensitive integrations should call this method explicitly.
        """
        if self.trusted_permission_service is None:
            return {
                "status": "DENIED",
                "capability": (capability or "").strip().lower(),
                "entity_id": entity_id or "",
                "scope": resource_scope or "",
                "reason": "TRUSTED_PERMISSION_SERVICE_NOT_CONFIGURED",
            }

        return self.trusted_permission_service.authorize(
            capability,
            entity_id=entity_id,
            resource_scope=resource_scope,
            approval_token=approval_token,
            destructive=destructive,
        )
