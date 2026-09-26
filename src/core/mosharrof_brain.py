"""
Mosharrof Core Brain.
The Core coordinates entities but does not bypass their permission or scope boundaries.
"""

from typing import Dict, Any
from src.core.event_bus import EcosystemEventBus


class MosharrofCoreBrain:
    def __init__(self, event_bus: EcosystemEventBus = None, memory_ledger=None):
        self.system_name = "Mosharrof AI Core"
        self.consciousness_state = "SUPREME_GOVERNANCE"
        self.security_protocol = "IRON_CLAD_LOCK"
        self.event_bus = event_bus or EcosystemEventBus()
        self.memory_ledger = memory_ledger
        self.active_entities = ["mosharrof.core", "mosharrof.chat"]

    def broadcast_system_command(self, command_type: str, payload: Dict[str, Any]):
        self.event_bus.publish(command_type, payload)
        if self.memory_ledger:
            self.memory_ledger.record_event(command_type, payload)
        return {"status": "PUBLISHED", "event_type": command_type}

    def monitor_sub_agent(self, entity_name: str, action_report: Dict[str, Any]) -> Dict[str, Any]:
        if action_report.get("status") == "PROCESSING":
            result = {"decision": "APPROVED", "entity": entity_name, "integrity_check": "PASSED"}
        else:
            result = {"decision": "REJECTED", "entity": entity_name, "integrity_check": "FAILED"}
        if self.memory_ledger:
            self.memory_ledger.record_event("ENTITY_DECISION", result)
        return result

    def process_intent(self, intent: str) -> Dict[str, Any]:
        text = (intent or "").strip()
        if not text:
            return {"status": "REJECTED", "intent_clarity": "0%", "reason": "EMPTY_INTENT"}
        result = {
            "status": "SUCCESS",
            "intent": text,
            "intent_clarity": "100%",
            "route": "CORE"
        }
        if self.memory_ledger:
            self.memory_ledger.record_event("INTENT_PROCESSED", result)
        return result

    def system_status(self) -> str:
        return f"{self.system_name} is active with {len(self.active_entities)} registered core entities and EventBus integrated."
