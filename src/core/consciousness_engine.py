"""Mosharrof entity consciousness/health coordinator.

Architecture rules (enforced):
- Every entity maintains its own consciousness and memory in isolation.
- One entity cannot see another entity's private state or memory.
- Only Mosharrof (core) can oversee everyone and act as the sole director.

This is a software coordination layer. No sentience claim.
"""
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

from src.core.audit_ledger import AuditLedger
from src.core.entity_memory import EntityMemoryBank
from src.core.entity_registry import EntityRegistry
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.permission_guard import PermissionGuard


class ConsciousnessEngine:
    """Isolated per-entity consciousness + central director (Mosharrof/core) oversight."""

    DIRECTOR_IDS = {"core", "mosharrof"}

    def __init__(
        self,
        registry: Optional[EntityRegistry] = None,
        event_bus: Optional[EcosystemEventBus] = None,
        memory_ledger: Optional[MemoryLedger] = None,
        audit_ledger: Optional[AuditLedger] = None,
        memory_bank: Optional[EntityMemoryBank] = None,
    ):
        self.registry = registry or EntityRegistry()
        self.event_bus = event_bus or EcosystemEventBus()
        self.memory_ledger = memory_ledger or MemoryLedger()
        self.audit_ledger = audit_ledger or AuditLedger()
        self.memory_bank = memory_bank or EntityMemoryBank()
        self._states: Dict[str, Dict[str, Any]] = {}

        for entity in self.registry.list():
            eid = entity["id"]
            self._states[eid] = {
                "entity_id": eid,
                "name": entity.get("name", eid),
                "state": "ACTIVE",
                "heartbeat": 0,
                "last_seen": None,
                "brain": entity.get("brain"),
                "scope": entity.get("scope"),
                "permissions": list(entity.get("permissions", [])),
                "delete_allowed": False,
            }
            self.memory_bank.get_or_create(eid)

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    def _is_director(self, caller_id: str) -> bool:
        return caller_id in self.DIRECTOR_IDS

    def _can_access(self, caller_id: str, target_id: str) -> bool:
        """Entity can only access itself. Director can access anyone."""
        if self._is_director(caller_id):
            return True
        return caller_id == target_id

    def heartbeat(self, entity_id: str, *, status: str = "ACTIVE",
                  signal: str = "HEARTBEAT", caller_id: Optional[str] = None) -> Dict[str, Any]:
        caller = caller_id or entity_id
        if not self._can_access(caller, entity_id):
            return {"status": "DENIED", "reason": "ISOLATION_VIOLATION",
                    "message": "One entity cannot control another entity's heartbeat"}
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
        self.memory_bank.remember(entity_id, "HEARTBEAT", event)
        return {"status": "ACTIVE", **event}

    def inspect(self, entity_id: str, *, caller_id: Optional[str] = None) -> Dict[str, Any]:
        """Inspect one entity. Only self or Director allowed."""
        caller = caller_id or entity_id
        if not self._can_access(caller, entity_id):
            return {
                "status": "DENIED",
                "reason": "ISOLATION_VIOLATION",
                "message": "One entity cannot see another entity's private state",
                "caller": caller,
                "target": entity_id,
            }
        state = self._states.get(entity_id)
        if state is None:
            return {"status": "DENIED", "reason": "UNKNOWN_ENTITY", "entity_id": entity_id}
        memory = self.memory_bank.inspect(entity_id)
        return {"status": "ACTIVE", **state, "memory": memory}

    def inspect_all(self, *, caller_id: str = "core") -> Dict[str, Any]:
        """Only Mosharrof (core) can see everyone's status."""
        if not self._is_director(caller_id):
            return {
                "status": "DENIED",
                "reason": "DIRECTOR_ONLY",
                "message": "Only Mosharrof (core) can oversee all entities",
                "caller": caller_id,
            }
        entities = [self.inspect(eid, caller_id=caller_id) for eid in sorted(self._states)]
        return {
            "status": "ACTIVE",
            "system": "Mosharrof Consciousness Engine",
            "director": caller_id,
            "entities": entities,
            "entity_count": len(entities),
            "delete_operations": "BLOCKED",
        }

    def broadcast_awareness(self, event_type: str, payload: Dict[str, Any],
                            recipients: Optional[Iterable[str]] = None,
                            *, caller_id: str = "core") -> Dict[str, Any]:
        if not self._is_director(caller_id):
            return {
                "status": "DENIED",
                "reason": "DIRECTOR_ONLY",
                "message": "Only Mosharrof can broadcast system-wide awareness",
            }
        target_ids = list(recipients) if recipients is not None else sorted(self._states)
        unknown = [eid for eid in target_ids if eid not in self._states]
        if unknown:
            return {"status": "DENIED", "reason": "UNKNOWN_ENTITY", "entities": unknown}
        message = {
            "event_type": event_type, "recipients": target_ids,
            "payload": dict(payload), "timestamp": self._now(),
            "from_director": caller_id,
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

    def self_analyze(self, entity_id: str, *, caller_id: Optional[str] = None) -> Dict[str, Any]:
        """Entity can only analyze itself. Director can analyze anyone."""
        caller = caller_id or entity_id
        if not self._can_access(caller, entity_id):
            return {
                "status": "DENIED",
                "reason": "ISOLATION_VIOLATION",
                "message": "One entity cannot analyze another entity",
            }
        if entity_id not in self._states:
            return {"status": "DENIED", "reason": "UNKNOWN_ENTITY", "entity_id": entity_id}

        state = self._states[entity_id]
        memory = self.memory_bank.inspect(entity_id)
        recent = memory.get("recent", [])

        issues: List[str] = []
        if state["heartbeat"] == 0:
            issues.append("NO_HEARTBEAT_YET")
        if state["last_seen"] is None:
            issues.append("NEVER_SEEN")
        if memory["short_term_count"] == 0:
            issues.append("EMPTY_MEMORY")

        health = "HEALTHY" if not issues else "NEEDS_ATTENTION"

        report = {
            "status": "ANALYZED",
            "entity_id": entity_id,
            "health": health,
            "issues": issues,
            "heartbeat": state["heartbeat"],
            "memory_short_term": memory["short_term_count"],
            "memory_long_term": memory["long_term_count"],
            "recent_events": recent,
            "analyzed_at": self._now(),
            "analyzed_by": caller,
        }

        self.memory_bank.remember(entity_id, "SELF_ANALYSIS", report)
        self.audit_ledger.record(entity_id, "SELF_ANALYSIS", health, issues=issues)
        self.event_bus.publish("ENTITY_SELF_ANALYSIS", report)
        return report

    def propose_improvement(self, entity_id: str, *, caller_id: Optional[str] = None) -> Dict[str, Any]:
        """Only self or Director can request improvement proposals. Never auto-executed."""
        analysis = self.self_analyze(entity_id, caller_id=caller_id)
        if analysis.get("status") != "ANALYZED":
            return analysis

        proposals: List[str] = []
        for issue in analysis.get("issues", []):
            if issue == "NO_HEARTBEAT_YET":
                proposals.append("Trigger initial heartbeat to confirm liveness")
            elif issue == "NEVER_SEEN":
                proposals.append("Perform first inspect cycle")
            elif issue == "EMPTY_MEMORY":
                proposals.append("Record first operational event into memory")

        if not proposals:
            proposals.append("No immediate improvements required — entity is healthy")

        result = {
            "status": "PROPOSAL_READY",
            "entity_id": entity_id,
            "health": analysis["health"],
            "proposals": proposals,
            "auto_execute": False,
            "proposed_at": self._now(),
            "requested_by": caller_id or entity_id,
        }

        self.memory_bank.remember(entity_id, "IMPROVEMENT_PROPOSAL", result, permanent=True)
        self.audit_ledger.record(entity_id, "IMPROVEMENT_PROPOSAL", "RECORDED", count=len(proposals))
        return result
