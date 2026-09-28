"""
Mosharrof Core Brain — The Sole Director

Architecture rules:
- Every entity maintains its own consciousness and memory in isolation.
- One entity cannot see another entity's private state.
- Only Mosharrof (this Core Brain) can oversee everyone and act as director.

No sentience claim. No destructive capability.
"""
from typing import Dict, Any, Optional
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.consciousness_system import EntityConsciousnessSystem
from src.core.permission_guard import PermissionGuard
from src.core.brain_adapter import BrainAdapter
from src.core.audit_ledger import AuditLedger
from src.core.entity_registry import EntityRegistry
from src.core.consciousness_monitor import EntityConsciousnessMonitor
from src.core.consciousness_engine import ConsciousnessEngine
from src.core.entity_memory import EntityMemoryBank


class MosharrofCoreBrain:
    """Mosharrof — the sole director who can see and coordinate all entities."""

    def __init__(
        self,
        event_bus: Optional[EcosystemEventBus] = None,
        memory_ledger: Optional[MemoryLedger] = None,
        permission_guard: Optional[PermissionGuard] = None,
        brain_adapter: Optional[BrainAdapter] = None,
        audit_ledger: Optional[AuditLedger] = None,
    ):
        self.system_name = "Mosharrof Core"
        self.role = "SOLE_DIRECTOR"
        self.consciousness_state = "ACTIVE"
        self.security_protocol = "NO_DELETE"
        self.event_bus = event_bus or EcosystemEventBus()
        self.memory_ledger = memory_ledger or MemoryLedger()
        self.permission_guard = permission_guard or PermissionGuard()
        self.brain_adapter = brain_adapter or BrainAdapter(entity_id="core")
        self.audit_ledger = audit_ledger or AuditLedger()
        self.entity_registry = EntityRegistry()
        self.consciousness_monitor = EntityConsciousnessMonitor(self.entity_registry.list())
        self.active_entities = [
            "core", "chat", "sidebar", "ui", "voice", "storage",
            "tool_factory", "quran_research"
        ]

        self.consciousness = EntityConsciousnessSystem(
            [{"id": x, "brain": x} for x in self.active_entities],
            event_bus=self.event_bus,
            memory_ledger=self.memory_ledger,
            permission_guard=self.permission_guard,
        )
        self.consciousness.awaken_all()

        self.memory_bank = EntityMemoryBank()

        self.consciousness_engine = ConsciousnessEngine(
            registry=self.entity_registry,
            event_bus=self.event_bus,
            memory_ledger=self.memory_ledger,
            audit_ledger=self.audit_ledger,
            memory_bank=self.memory_bank,
        )

    def authorize_action(self, *, entity_id: str, operation: str, scope: str = "") -> Dict[str, Any]:
        permission = self.permission_guard.check(
            operation, scope=scope or entity_id, entity_scope=entity_id
        )
        if permission["status"] == "DENIED":
            self.memory_ledger.record_event("ACTION_DENIED", permission)
            self.audit_ledger.record(
                entity_id, "ACTION_DENIED", "DENIED",
                operation=permission["operation"], scope=permission["scope"],
                reason=permission["reason"]
            )
            return permission
        result = {
            "status": "ALLOWED",
            "entity": entity_id,
            "operation": operation.upper(),
            "scope": scope or entity_id,
        }
        self.memory_ledger.record_event("ACTION_ALLOWED", result)
        self.audit_ledger.record(
            entity_id, "ACTION_ALLOWED", "ALLOWED",
            operation=result["operation"], scope=result["scope"]
        )
        return result

    def broadcast_system_command(self, command_type: str, payload: Dict[str, Any]):
        self.event_bus.publish(command_type, payload)
        self.memory_ledger.record_event(command_type, payload)
        self.audit_ledger.record("core", "SYSTEM_COMMAND", "RECORDED", command_type=command_type)

    def monitor_sub_agent(self, entity_name: str, action_report: Dict[str, Any]) -> Dict[str, Any]:
        permission = self.permission_guard.check(
            action_report.get("operation", "PROCESS"),
            scope=action_report.get("scope", entity_name),
            entity_scope=action_report.get("entity_scope", entity_name),
            destructive=bool(action_report.get("destructive", False)),
        )
        if permission["status"] == "DENIED":
            result = {
                "decision": "REJECTED", "entity": entity_name,
                "integrity_check": "FAILED", "reason": permission["reason"]
            }
        elif action_report.get("status") == "PROCESSING":
            result = {
                "decision": "APPROVED", "entity": entity_name,
                "integrity_check": "PASSED", "reason": "Within declared scope"
            }
        else:
            result = {
                "decision": "REJECTED", "entity": entity_name,
                "integrity_check": "FAILED", "reason": "Policy or state check failed"
            }
        self.memory_ledger.record_event("ENTITY_ACTION_REVIEWED", result)
        self.audit_ledger.record(
            entity_name, "ENTITY_ACTION_REVIEWED", result["decision"], **result
        )
        return result

    def process_intent(self, text: str) -> Dict[str, Any]:
        text = (text or "").strip()
        if not text:
            return {"status": "EMPTY", "intent": "UNKNOWN", "intent_clarity": 0.0}
        lowered = text.lower()
        if any(k in lowered for k in ("quran", "কুরআন", "কোরআন")):
            intent = "RESEARCH"
        elif any(k in lowered for k in ("file", "ফাইল", "folder", "ফোল্ডার")):
            intent = "STORAGE"
        elif any(k in lowered for k in ("tool", "টুল")):
            intent = "TOOL"
        else:
            intent = "GENERAL"
        result = {
            "status": "SUCCESS",
            "intent": intent,
            "intent_clarity": 1.0,
            "text": text,
            "brain": self.brain_adapter.describe(),
        }
        self.memory_ledger.record_event("INTENT_PROCESSED", result)
        self.audit_ledger.record("core", "INTENT_PROCESSED", "SUCCESS", intent=intent)
        return result

    def consciousness_report(self) -> Dict[str, Any]:
        report = self.consciousness_monitor.scan()
        self.audit_ledger.record(
            "core", "CONSCIOUSNESS_SCAN", report["state"],
            entity_count=report["entity_count"],
            degraded_count=report["degraded_count"]
        )
        return report

    def system_status(self) -> Dict[str, Any]:
        """Director view: Mosharrof can see everything."""
        engine_snapshot = self.consciousness_engine.inspect_all(caller_id="core")
        return {
            "system": self.system_name,
            "role": self.role,
            "state": self.consciousness_state,
            "entities": list(self.active_entities),
            "brain": self.brain_adapter.describe(),
            "consciousness_monitor": self.consciousness_report(),
            "consciousness_engine": engine_snapshot,
            "consciousness_verify": self.consciousness.verify(),
            "memory_bank": self.memory_bank.inspect_all(),
            "delete_operations": "BLOCKED",
            "isolation_rule": "Entities isolated from each other; only Mosharrof sees all",
        }

    def entity_self_analyze(self, entity_id: str) -> Dict[str, Any]:
        """Director requests analysis of any entity, or entity analyzes itself."""
        return self.consciousness_engine.self_analyze(entity_id, caller_id="core")

    def entity_propose_improvement(self, entity_id: str) -> Dict[str, Any]:
        """Director requests improvement proposals (never auto-executed)."""
        return self.consciousness_engine.propose_improvement(entity_id, caller_id="core")
