"""Runtime awareness and health monitor for every registered Mosharrof entity.

This is operational awareness: every entity is discoverable, has a declared
brain identity, scope and permission profile, and is checked without inventing
sentience or bypassing policy.
"""
from __future__ import annotations

from typing import Any, Dict, Iterable


class EntityConsciousnessMonitor:
    REQUIRED = ("id", "brain", "scope", "permission_profile", "delete_allowed")

    def __init__(self, entities: Iterable[Dict[str, Any]]):
        self.entities = list(entities)

    def inspect(self, entity: Dict[str, Any]) -> Dict[str, Any]:
        missing = [key for key in self.REQUIRED if key not in entity]
        delete_blocked = entity.get("delete_allowed") is False
        brain_declared = bool(entity.get("brain"))
        scope_declared = bool(entity.get("scope"))
        permission_declared = bool(entity.get("permission_profile"))
        healthy = not missing and delete_blocked and brain_declared and scope_declared and permission_declared
        return {
            "entity_id": entity.get("id"),
            "state": "AWARE" if healthy else "DEGRADED",
            "brain_declared": brain_declared,
            "scope_declared": scope_declared,
            "permission_declared": permission_declared,
            "delete_blocked": delete_blocked,
            "missing": missing,
        }

    def scan(self) -> Dict[str, Any]:
        reports = [self.inspect(entity) for entity in self.entities]
        degraded = [r for r in reports if r["state"] != "AWARE"]
        return {
            "state": "AWARE" if self.entities and not degraded else "DEGRADED",
            "entity_count": len(reports),
            "aware_count": len(reports) - len(degraded),
            "degraded_count": len(degraded),
            "entities": reports,
            "runtime_provider_attached": False,
            "note": "AWARE means structurally monitored and policy-bounded; it does not claim sentience.",
        }
