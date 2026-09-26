"""
Mosharrof Core Brain.
Coordinates entities without bypassing their permissions.
Capability = identity × model × permission × policy × scope.
"""
from typing import Any, Dict, Optional
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

    def broadcast_system_command(self, command_type: str, payload: Dict[str, Any]):
        self.event_bus.publish(command_type, payload)
        self.memory_ledger.record_event("SYSTEM_COMMAND",
            {"command_type": command_type, "payload": payload})

    def monitor_sub_agent(self, entity_name: str, action_report: Dict[str, Any]) -> Dict[str, Any]:
        if action_report.get("operation") == "DELETE" or action_report.get("destructive") is True:
            return {"decision": "REJECTED",
                    "reason": "DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED",
                    "entity": entity_name}
        if action_report.get("status") in {"PROCESSING", "READY", "SUCCESS"}:
            return {"decision": "APPROVED",
                    "master_command": f"Proceed within assigned scope for {entity_name}.",
                    "integrity_check": "PASSED"}
        return {"decision": "REJECTED",
                "master_command": "Policy or state validation failed.",
                "integrity_check": "FAILED"}

    def process_intent(self, user_query: str) -> Dict[str, Any]:
        query = (user_query or "").strip()
        if not query:
            return {"status": "EMPTY", "intent_clarity": "0%", "intent": "UNKNOWN"}
        lowered = query.lower()
        intent = "ORGANIZE_AND_RESEARCH" if any(
            word in lowered for word in ("গুছ", "ফাইল", "research", "organize")
        ) else "GENERAL_REQUEST"
        result = {"status": "SUCCESS", "intent": intent,
                  "intent_clarity": "100%", "query": query}
        self.memory_ledger.record_event("INTENT_PROCESSED", result)
        return result

    def system_status(self) -> str:
        return (f"{self.system_name} is active with "
                f"{len(self.active_entities)} registered entities and NO_DELETE policy.")
