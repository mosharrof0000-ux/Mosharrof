"""Universal, registry-backed capability authorization for Mosharrof.

Catalogue entries describe what the ecosystem may eventually support; they do
not grant authority. Every action needs an explicit grant, a matching scope,
policy approval, and any required provider/user approval. Decisions are
audited in-memory; durable append-only audit storage is a separate integration.
"""
from __future__ import annotations

import fnmatch
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable


class UniversalPermissionEngine:
    """Fail-closed capability gate driven by config/capability_registry.json."""

    def __init__(self, registry_path: str | Path | None = None):
        self.registry_path = Path(registry_path) if registry_path else (
            Path(__file__).resolve().parents[2] / "config" / "capability_registry.json"
        )
        self.registry = json.loads(self.registry_path.read_text(encoding="utf-8"))
        self.capabilities = {
            capability
            for values in self.registry.get("categories", {}).values()
            for capability in values
        }
        rules = self.registry.get("rules", {})
        self.blocked_patterns = tuple(rules.get("permanently_blocked", ()))
        self.approval_required = set(rules.get("explicit_user_approval", ()))
        self.provider_prefixes = tuple(rules.get("provider_required_prefixes", ()))
        self.audit_log: list[dict[str, Any]] = []

    @staticmethod
    def _matches(patterns: Iterable[str], value: str) -> bool:
        return any(fnmatch.fnmatchcase(value, pattern) for pattern in patterns)

    @staticmethod
    def _scope_matches(resource_scope: str, entity_scope: str) -> bool:
        resource = (resource_scope or "").strip().strip("/")
        allowed = (entity_scope or "").strip().strip("/")
        if not resource or not allowed:
            return False
        if allowed.endswith("/*"):
            prefix = allowed[:-2].rstrip("/")
            return resource == prefix or resource.startswith(prefix + "/")
        return resource == allowed or resource.startswith(allowed + "/")

    def _record(self, decision: dict[str, Any]) -> dict[str, Any]:
        event = dict(decision)
        event["timestamp"] = datetime.now(timezone.utc).isoformat()
        self.audit_log.append(event)
        return dict(decision)

    def authorize(
        self,
        capability: str,
        *,
        entity_id: str,
        granted_permissions: Iterable[str] = (),
        resource_scope: str = "",
        entity_scope: str = "",
        policy_ok: bool = False,
        provider_ready: bool = False,
        user_approved: bool = False,
        destructive: bool = False,
    ) -> dict[str, Any]:
        """Return ALLOWED/DENIED. Unknown or unconfigured abilities fail closed."""
        requested = (capability or "").strip().lower()
        base = {"capability": requested, "entity_id": entity_id or "",
                "scope": resource_scope or ""}

        def deny(reason: str) -> dict[str, Any]:
            return self._record({**base, "status": "DENIED", "reason": reason})

        if not requested or requested not in self.capabilities:
            return deny("UNKNOWN_CAPABILITY")
        if destructive or self._matches(self.blocked_patterns, requested):
            return deny("PERMANENT_SAFETY_BLOCK")
        if not policy_ok:
            return deny("POLICY_DENIED")
        if not self._scope_matches(resource_scope, entity_scope):
            return deny("SCOPE_BOUNDARY")
        grants = {str(item).strip().lower() for item in granted_permissions}
        if not any(fnmatch.fnmatchcase(requested, grant) for grant in grants):
            return deny("PERMISSION_NOT_GRANTED")
        if any(requested.startswith(prefix) for prefix in self.provider_prefixes) and not provider_ready:
            return deny("PROVIDER_NOT_READY")
        if requested in self.approval_required and not user_approved:
            return deny("USER_APPROVAL_REQUIRED")
        return self._record({**base, "status": "ALLOWED", "reason": "ALL_GATES_PASSED"})

    def audit_events(self) -> list[dict[str, Any]]:
        """Return a copy so callers cannot mutate the engine's audit list."""
        return [dict(event) for event in self.audit_log]

    def has_capability(self, capability: str) -> bool:
        return (capability or "").strip().lower() in self.capabilities

    def list_capabilities(self, category: str | None = None) -> list[str]:
        categories = self.registry.get("categories", {})
        if category is not None:
            return sorted(categories.get(category, []))
        return sorted(self.capabilities)
