"""Mosharrof Core Brain
Central orchestration layer. Capability is bounded by identity, permission,
policy, scope and assigned tools.
"""
from typing import Any, Dict, Optional
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.permission_engine import PermissionEngine
from src.core.policy_engine import PolicyEngine

class MosharrofCoreBrain:
    def __init__(self, event_bus: Optional[EcosystemEventBus] = None,
                 memory_ledger: Optional[MemoryLedger] = None,
                 permission_engine: Optional[PermissionEngine] = None,
                 policy_engine: Optional[PolicyEngine] = None):
        self.system_name = "Mosharrof AI Core"
        self.consciousness_state = "ACTIVE"
        self.security_protocol = "NO_DELETE"
        self.event_bus = event_bus or EcosystemEventBus()
        self.memory_ledger = memory_ledger or MemoryLedger()
        self.permission_engine = permission_engine or PermissionEngine()
        self.policy_engine = policy_engine or PolicyEngine()
        self.active_entities = ["core", "chat", "sidebar", "quran-research"]

    def authorize_action(self, *, entity_id: str, operation: str,
                         scope: str = "", entity_scope: str = "") -> Dict[str, Any]:
        permission = self.permission_engine.authorize(operation, scope=scope)
        if permission["status"] != "ALLOWED":
            self.memory_ledger.record_event("ACTION_DENIED", permission)
            return permission
        policy = self.policy_engine.check(operation=operation, scope=scope,
                                          entity_scope=entity_scope or entity_id)
        if not policy["allowed"]:
            result = {"status": "DENIED", "operation": operation.upper(),
                      "reason": policy["reason"]}
            self.memory_ledger.record_event("ACTION_DENIED", result)
            return result
        result = {"status": "ALLOWED", "entity": entity_id,
                  "operation": operation.upper(), "scope": scope}
        self.memory_ledger.record_event("ACTION_ALLOWED", result)
        return result

    def broadcast_system_command(self, command_type: str, payload: Dict[str, Any]):
        self.event_bus.publish(command_type, payload)
        self.memory_ledger.record_event("SYSTEM_COMMAND",
            {"command_type": command_type, "payload": payload})

    def monitor_sub_agent(self, entity_name: str, action_report: Dict[str, Any]) -> Dict[str, Any]:
        operation = action_report.get("operation", "READ")
        authorization = self.authorize_action(
            entity_id=entity_name,
            operation=operation,
            scope=action_report.get("scope", ""),
            entity_scope=action_report.get("entity_scope", ""),
        )
        allowed = action_report.get("status") == "PROCESSING" and authorization["status"] == "ALLOWED"
        result = {"decision": "APPROVED" if allowed else "REJECTED",
                  "entity": entity_name,
                  "integrity_check": "PASSED" if allowed else "FAILED",
                  "authorization": authorization}
        self.memory_ledger.record_event("ENTITY_DECISION", result)
        return result

    def process_intent(self, text: str) -> Dict[str, Any]:
        cleaned = (text or "").strip()
        if not cleaned:
            return {"status": "EMPTY", "intent": "UNKNOWN", "intent_clarity": 0.0}
        lowered = cleaned.lower()
        if any(w in lowered for w in ("ফাইল","file","folder","ফোল্ডার")):
            intent = "STORAGE"
        elif any(w in lowered for w in ("টুল","tool")):
            intent = "TOOL"
        elif any(w in lowered for w in ("ভয়েস","voice","কথা")):
            intent = "VOICE"
        elif any(w in lowered for w in ("কুরআন","কোরআন","quran")):
            intent = "RESEARCH"
        else:
            intent = "GENERAL"
        result = {"status":"SUCCESS","intent":intent,"intent_clarity":1.0,"input":cleaned}
        self.memory_ledger.record_event("INTENT_PROCESSED", result)
        return result

    def system_status(self) -> Dict[str, Any]:
        return {"system":self.system_name,"state":self.consciousness_state,
                "security_protocol":self.security_protocol,
                "active_entities":list(self.active_entities),
                "delete_operations":"BLOCKED"}
