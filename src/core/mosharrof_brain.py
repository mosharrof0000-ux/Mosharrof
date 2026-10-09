"""
Mosharrof Core Brain — The Sole Sovereign Director

Architecture rules:
- Every entity maintains its own consciousness and memory in isolation.
- One entity cannot see another entity's private state.
- Only Mosharrof (this Core Brain) can oversee everyone and act as director.
- Lifecycle (Birth / Death / Archive) is under Sovereign authority.
- Knowledge grows only through the Master Learning Plan (verify → ask → apply → remember).

No sentience claim. No destructive capability.
"""
from typing import Dict, Any, Optional, List
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.consciousness_system import EntityConsciousnessSystem
from src.core.permission_guard import PermissionGuard
from src.core.trusted_permission_service import TrustedPermissionService
from src.core.brain_adapter import BrainAdapter
from src.core.audit_ledger import AuditLedger
from src.core.entity_registry import EntityRegistry
from src.core.consciousness_monitor import EntityConsciousnessMonitor
from src.core.consciousness_engine import ConsciousnessEngine
from src.core.entity_memory import EntityMemoryBank
from src.core.entity_lifecycle import EntityLifecycle
from src.core.persistent_store import PersistentStore


class MosharrofCoreBrain:
    """Mosharrof — the sole Sovereign Director who can see and coordinate all entities."""

    def __init__(
        self,
        event_bus: Optional[EcosystemEventBus] = None,
        memory_ledger: Optional[MemoryLedger] = None,
        permission_guard: Optional[PermissionGuard] = None,
        brain_adapter: Optional[BrainAdapter] = None,
        audit_ledger: Optional[AuditLedger] = None,
        trusted_permission_service: Optional[TrustedPermissionService] = None,
    ):
        self.system_name = "Mosharrof Core"
        self.role = "SOLE_SOVEREIGN_DIRECTOR"
        self.consciousness_state = "ACTIVE"
        self.security_protocol = "NO_DELETE"
        self.event_bus = event_bus or EcosystemEventBus()
        self.memory_ledger = memory_ledger or MemoryLedger()
        self.permission_guard = permission_guard or PermissionGuard(
            trusted_permission_service=trusted_permission_service
        )
        self.brain_adapter = brain_adapter or BrainAdapter(entity_id="core")
        self.audit_ledger = audit_ledger or AuditLedger()
        self.entity_registry = EntityRegistry()
        self.consciousness_monitor = EntityConsciousnessMonitor(self.entity_registry.list())
        self.active_entities = [
            "core", "chat", "sidebar", "ui", "voice", "storage",
            "tool_factory", "quran_research"
        ]

        # Compatibility layer
        self.consciousness = EntityConsciousnessSystem(
            [{"id": x, "brain": x} for x in self.active_entities],
            event_bus=self.event_bus,
            memory_ledger=self.memory_ledger,
            permission_guard=self.permission_guard,
        )
        self.consciousness.awaken_all()

        # Persistent substrate
        self.persistent_store = PersistentStore()
        self.lifecycle = EntityLifecycle(store=self.persistent_store, audit=self.audit_ledger)

        # Per-entity memory bank (now backed by persistent store in future iterations)
        self.memory_bank = EntityMemoryBank()

        # Full consciousness engine with isolation + self-analysis
        self.consciousness_engine = ConsciousnessEngine(
            registry=self.entity_registry,
            event_bus=self.event_bus,
            memory_ledger=self.memory_ledger,
            audit_ledger=self.audit_ledger,
            memory_bank=self.memory_bank,
        )

        # Ensure core itself has been formally born
        self._ensure_core_born()

    def _ensure_core_born(self):
        status = self.lifecycle.status("core")
        if status.get("lifecycle") in (None, "UNBORN"):
            self.lifecycle.birth(
                "core",
                actor="core",
                name="Mosharrof",
                brain="core",
                scope="sovereign",
                reason="Sovereign self-instantiation",
            )

    # ── Standard coordination APIs ──────────────────────────────────────

    def authorize_capability_action(
        self,
        *,
        entity_id: str,
        capability: str,
        resource_scope: str,
        approval_token: Any = None,
        destructive: bool = False,
    ) -> Dict[str, Any]:
        """Authorize a registry capability through trusted context and audit it.

        Unlike the legacy operation-level authorize_action(), this entry point
        requires TrustedPermissionService to be configured. No approval token
        or other secret is written to the audit record.
        """
        decision = self.permission_guard.authorize_capability(
            capability,
            entity_id=entity_id,
            resource_scope=resource_scope,
            approval_token=approval_token,
            destructive=destructive,
        )
        status = decision.get("status", "DENIED")
        action = (
            "CAPABILITY_ACTION_ALLOWED"
            if status == "ALLOWED"
            else "CAPABILITY_ACTION_DENIED"
        )
        self.memory_ledger.record_event(action, decision)
        self.audit_ledger.record(
            entity_id,
            action,
            status,
            capability=decision.get("capability", capability),
            scope=decision.get("scope", resource_scope),
            reason=decision.get("reason", "MISSING_DECISION_REASON"),
        )
        return decision

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
            "lifecycle_core": self.lifecycle.status("core"),
            "delete_operations": "BLOCKED",
            "isolation_rule": "Entities isolated from each other; only Mosharrof sees all",
            "learning_plan": "docs/MOSHARROF_MASTER_LEARNING_PLAN.md",
        }

    # ── Sovereign Lifecycle APIs ────────────────────────────────────────

    def birth_entity(self, entity_id: str, *, name: str = None, brain: str = None,
                     scope: str = None, reason: str = "Sovereign decree") -> Dict[str, Any]:
        """Only Mosharrof may authorize birth of a new subject."""
        return self.lifecycle.birth(
            entity_id, actor="core", name=name, brain=brain, scope=scope, reason=reason
        )

    def retire_entity(self, entity_id: str, *, reason: str = "Graceful retirement") -> Dict[str, Any]:
        return self.lifecycle.retire(entity_id, actor="core", reason=reason)

    def archive_entity(self, entity_id: str, *, reason: str = "End of active life") -> Dict[str, Any]:
        """Death → immutable archive. History is preserved forever."""
        return self.lifecycle.archive(entity_id, actor="core", reason=reason)

    def entity_lifecycle_status(self, entity_id: str) -> Dict[str, Any]:
        return self.lifecycle.status(entity_id)

    def read_entity_archive(self, entity_id: str) -> Dict[str, Any]:
        """Only the Sovereign may read the sealed archive of a dead entity."""
        return self.lifecycle.read_archive(entity_id, actor="core")

    # ── Consciousness helpers ───────────────────────────────────────────

    def entity_self_analyze(self, entity_id: str) -> Dict[str, Any]:
        return self.consciousness_engine.self_analyze(entity_id, caller_id="core")

    def entity_propose_improvement(self, entity_id: str) -> Dict[str, Any]:
        return self.consciousness_engine.propose_improvement(entity_id, caller_id="core")

    # ── Learning support (Master Plan) ──────────────────────────────────

    def record_lesson(self, *, problem: str, solution: str, teacher: str,
                      tags: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Explicitly save a successful lesson into Mosharrof's long-term memory.
        Call this after a senior teacher (Grok, ChatGPT, etc.) helps solve something.
        """
        lesson = {
            "problem": problem,
            "solution": solution,
            "teacher": teacher,
            "tags": tags or [],
            "recorded_by": "core",
        }
        self.memory_bank.remember("core", "LESSON", lesson, permanent=True)
        self.persistent_store.append_memory("core", {
            "event_type": "LESSON_LEARNED",
            **lesson,
        })
        self.audit_ledger.record("core", "LESSON_LEARNED", "RECORDED", teacher=teacher)
        return {"status": "RECORDED", "lesson": lesson}
