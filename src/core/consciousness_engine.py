"""Mosharrof entity consciousness/health coordinator.

This is a software coordination layer: every registered entity gets a stable
identity, declared capabilities, heartbeat/state, and an auditable event trail.
It does not claim sentience or infer a person's mental state.
"""
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, Optional

from src.core.audit_ledger import AuditLedger
from src.core.entity_registry import EntityRegistry
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.permission_guard import PermissionGuard


class ConsciousnessEngine:
    """Give every registered Mosharrof entity a live, inspectable system state."""

    def __init__(
        self,
        registry: Optional[EntityRegistry] = None,
        event_bus: Optional[EcosystemEventBus] = None,
        memory_ledger: Optional[MemoryLedger] = None,
        audit_ledger: Optional[AuditLedger] = None,
    ):
        self.registry = registry or EntityRegistry()
        self.event_bus = event_bus or EcosystemEventBus()
        self.memory_ledger = memory_ledger or MemoryLedger()
        self.audit_ledger = audit_ledger or AuditLedger()
        self._states: Dict[str, Dict[str, Any]] = {}

        for entity in self.registry.list():
            self._states[entity["id"]] = {
                "entity_id": entity["id"],
                "name": entity.get("name", entity["id"]),
                "state": "ACTIVE",
                "heartbeat": 0,
                "last_seen": None,
                "brain": entity.get("brain"),
                "scope": entity.get("scope"),
                "permissions": list(entity.get("permissions", [])),
                "delete_allowed": False,
            }

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    def heartbeat(self, entity_id: str, *, status: str = "ACTIVE",
                  signal: str = "HEARTBEAT") -> Dict[str, Any]:
        if entity_id not in self._states:
            return {"status": "DENIED", "reason": "UNKNOWN_ENTITY", "entity_id": entity_id}
        state = self._states[entity_id]
        state["state"] = status.upper()
        state["heartbeat"] += 1
        state["last_seen"] = self._now()
        event = {
            "entity_id": entity_id, "state": state["state"],
            "heartbeat": state["heartbeat"], "signal": signal,
            "timestamp": state["last_seen"],
        }
        self.memory_ledger.record_event("ENTITY_HEARTBEAT", event)
        self.audit_ledger.record(entity_id, "HEARTBEAT", "RECORDED", state=state["state"])
        self.event_bus.publish("ENTITY_HEARTBEAT", event)
        return {"status": "ACTIVE", **event}

    def inspect(self, entity_id: str) -> Dict[str, Any]:
        state = self._states.get(entity_id)
        if state is None:
            return {"status": "DENIED", "reason": "UNKNOWN_ENTITY", "entity_id": entity_id}
        return {"status": "ACTIVE", **state}

    def inspect_all(self) -> Dict[str, Any]:
        entities = [self.inspect(entity_id) for entity_id in sorted(self._states)]
        return {
            "status": "ACTIVE", "system": "Mosharrof Consciousness Engine",
            "entities": entities, "entity_count": len(entities),
            "delete_operations": "BLOCKED",
        }

    def broadcast_awareness(self, event_type: str, payload: Dict[str, Any],
                            recipients: Optional[Iterable[str]] = None) -> Dict[str, Any]:
        target_ids = list(recipients) if recipients is not None else sorted(self._states)
        unknown = [entity_id for entity_id in target_ids if entity_id not in self._states]
        if unknown:
            return {"status": "DENIED", "reason": "UNKNOWN_ENTITY", "entities": unknown}
        message = {
            "event_type": event_type, "recipients": target_ids,
            "payload": dict(payload), "timestamp": self._now(),
        }
        result = self.event_bus.publish(event_type, message)
        self.memory_ledger.record_event("AWARENESS_BROADCAST", message)
        self.audit_ledger.record("core", "AWARENESS_BROADCAST", result["status"],
                                 event_type=event_type, recipients=target_ids)
        return {"status": result["status"], **message, "delivery": result}

    def authorize(self, entity_id: str, operation: str, scope: str = "") -> Dict[str, Any]:
        if entity_id not in self._states:
            return {"status": "DENIED", "reason": "UNKNOWN_ENTITY"}
        return PermissionGuard(profile=entity_id).check(
            operation, scope=scope or entity_id, entity_scope=entity_id
        )
