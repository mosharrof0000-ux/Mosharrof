"""Mosharrof Core Brain."""
from typing import Dict, Any, Optional
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger

class MosharrofCoreBrain:
    def __init__(self, event_bus: Optional[EcosystemEventBus] = None,
                 memory_ledger: Optional[MemoryLedger] = None):
        self.system_name = "Mosharrof AI Core"
        self.consciousness_state = "CORE_READY"
        self.security_protocol = "NO_DELETE_POLICY"
        self.event_bus = event_bus or EcosystemEventBus()
        self.memory_ledger = memory_ledger or MemoryLedger()
        self.active_entities = []

    def register_entity(self, entity_id: str) -> Dict[str, Any]:
        if entity_id not in self.active_entities:
            self.active_entities.append(entity_id)
            self.memory_ledger.record_event("ENTITY_REGISTERED", {"entity_id": entity_id})
        return {"status": "SUCCESS", "entity_id": entity_id}

    def broadcast_system_command(self, command_type: str, payload: Dict[str, Any]):
        self.event_bus.publish(command_type, payload)
        self.memory_ledger.record_event("SYSTEM_COMMAND", {"command_type": command_type, "payload": payload})

    def monitor_sub_agent(self, entity_name: str, action_report: Dict[str, Any]) -> Dict[str, Any]:
        if action_report.get("operation") == "DELETE" or action_report.get("destructive"):
            return {"decision": "REJECTED", "master_command": "Delete and destructive operations are blocked.", "integrity_check": "PASSED"}
        if action_report.get("status") == "PROCESSING":
            return {"decision": "APPROVED", "master_command": f"Proceed within assigned scope for {entity_name}.", "integrity_check": "PASSED"}
        return {"decision": "REJECTED", "master_command": "Action requires valid state and policy.", "integrity_check": "FAILED"}

    def process_intent(self, intent: str) -> Dict[str, Any]:
        clean_intent = (intent or "").strip()
        if not clean_intent:
            return {"status": "EMPTY", "intent": "", "intent_clarity": "0%"}
        result = {"status": "SUCCESS", "intent": clean_intent, "intent_clarity": "100%", "next_step": "ROUTE_TO_APPROPRIATE_ENTITY"}
        self.memory_ledger.record_event("INTENT_RECEIVED", result)
        return result

    def system_status(self) -> Dict[str, Any]:
        return {"status": "ACTIVE", "system": self.system_name, "entities": list(self.active_entities), "security_protocol": self.security_protocol}
