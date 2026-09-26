"""Mosharrof Core Brain — responsibility-aware coordinator."""
from typing import Dict, Any, Optional
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger

class MosharrofCoreBrain:
    def __init__(self, event_bus: Optional[EcosystemEventBus] = None,
                 memory_ledger: Optional[MemoryLedger] = None):
        self.system_name = "Mosharrof AI Core"
        self.consciousness_state = "ACTIVE"
        self.security_protocol = "NO_DELETE"
        self.event_bus = event_bus or EcosystemEventBus()
        self.memory_ledger = memory_ledger or MemoryLedger()
        self.active_entities = []

    def register_entity(self, entity_id: str) -> Dict[str, Any]:
        if entity_id not in self.active_entities:
            self.active_entities.append(entity_id)
        return {"status": "REGISTERED", "entity_id": entity_id}

    def process_intent(self, intent: str) -> Dict[str, Any]:
        text = (intent or "").strip()
        if not text:
            return {"status": "EMPTY", "intent_clarity": "0%", "intent": ""}
        self.memory_ledger.record_event("INTENT_RECEIVED", {"intent": text})
        return {
            "status": "SUCCESS",
            "intent": text,
            "intent_clarity": "100%",
            "policy": "NO_DELETE",
        }

    def broadcast_system_command(self, command_type: str, payload: Dict[str, Any]):
        self.event_bus.publish(command_type, payload)

    def monitor_sub_agent(self, entity_name: str, action_report: Dict[str, Any]) -> Dict[str, Any]:
        status = action_report.get("status")
        if status == "PROCESSING":
            return {"decision": "APPROVED", "entity": entity_name,
                    "master_command": "Proceed within assigned scope.",
                    "integrity_check": "PASSED"}
        return {"decision": "REJECTED", "entity": entity_name,
                "master_command": "Policy or state check failed.",
                "integrity_check": "FAILED"}

    def system_status(self) -> Dict[str, Any]:
        return {
            "system": self.system_name,
            "state": self.consciousness_state,
            "entities": len(self.active_entities),
            "delete_allowed": False,
        }
