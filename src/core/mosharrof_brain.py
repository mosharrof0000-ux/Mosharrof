"""Mosharrof Core Brain."""
from typing import Any, Dict, Optional
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger

class MosharrofCoreBrain:
    def __init__(self, event_bus: Optional[EcosystemEventBus] = None, memory_ledger: Optional[MemoryLedger] = None):
        self.system_name = "Mosharrof AI Core"
        self.consciousness_state = "ACTIVE"
        self.security_protocol = "DELETE_BLOCKED"
        self.event_bus = event_bus or EcosystemEventBus()
        self.memory_ledger = memory_ledger or MemoryLedger()
        self.active_entities = ["core", "chat", "ui", "tool_registry"]

    def broadcast_system_command(self, command_type: str, payload: Dict[str, Any]):
        self.event_bus.publish(command_type, payload)
        self.memory_ledger.record_event("SYSTEM_COMMAND_BROADCAST", {"command_type": command_type, "payload": payload})

    def monitor_sub_agent(self, entity_name: str, action_report: Dict[str, Any]) -> Dict[str, Any]:
        allowed = action_report.get("status") == "PROCESSING" and action_report.get("permission") != "DELETE"
        result = {"decision": "APPROVED" if allowed else "REJECTED", "entity": entity_name,
                  "integrity_check": "PASSED" if allowed else "FAILED",
                  "reason": "POLICY_OK" if allowed else "POLICY_BLOCKED"}
        self.memory_ledger.record_event("ENTITY_ACTION_REVIEWED", result)
        return result

    def process_intent(self, intent: str) -> Dict[str, Any]:
        text = (intent or "").strip()
        if not text:
            return {"status": "EMPTY", "intent_clarity": "0%", "route": "none"}
        lowered = text.lower()
        if any(word in lowered for word in ("file", "folder", "storage", "ফাইল", "ফোল্ডার")):
            route = "storage"
        elif any(word in lowered for word in ("tool", "টুল")):
            route = "tool_registry"
        else:
            route = "chat"
        result = {"status": "SUCCESS", "intent_clarity": "100%", "route": route, "intent": text}
        self.memory_ledger.record_event("INTENT_PROCESSED", result)
        return result

    def system_status(self) -> Dict[str, Any]:
        return {"system": self.system_name, "state": self.consciousness_state,
                "security": self.security_protocol, "entities": list(self.active_entities)}
