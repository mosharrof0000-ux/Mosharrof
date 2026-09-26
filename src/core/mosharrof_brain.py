"""Mosharrof Core Brain: coordination, intent routing and safety-aware state."""
from typing import Any, Dict, Optional
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger

class MosharrofCoreBrain:
    def __init__(self, event_bus: Optional[EcosystemEventBus] = None, memory_ledger: Optional[MemoryLedger] = None):
        self.system_name = "Mosharrof AI Core"
        self.consciousness_state = "ACTIVE"
        self.security_protocol = "DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED"
        self.event_bus = event_bus or EcosystemEventBus()
        self.memory_ledger = memory_ledger or MemoryLedger()
        self.active_entities = ["core", "chat", "sidebar", "quran-research"]

    def broadcast_system_command(self, command_type: str, payload: Dict[str, Any]):
        self.event_bus.publish(command_type, payload)
        self.memory_ledger.record_event("SYSTEM_COMMAND", {"command_type": command_type, "payload": payload})

    def monitor_sub_agent(self, entity_name: str, action_report: Dict[str, Any]) -> Dict[str, Any]:
        operation = str(action_report.get("operation", "")).upper()
        if operation == "DELETE" or action_report.get("destructive") is True:
            return {"decision": "REJECTED", "master_command": "Operation permanently blocked.", "integrity_check": "FAILED"}
        if action_report.get("status") == "PROCESSING":
            return {"decision": "APPROVED", "master_command": f"Proceed within {entity_name} scope.", "integrity_check": "PASSED"}
        return {"decision": "REJECTED", "master_command": "Policy or state validation failed.", "integrity_check": "FAILED"}

    def process_intent(self, user_text: str) -> Dict[str, Any]:
        text = (user_text or "").strip()
        if not text:
            return {"status": "EMPTY", "intent_clarity": "0%", "response": "No input received."}
        self.memory_ledger.record_event("USER_INTENT", {"text": text})
        return {"status": "SUCCESS", "intent_clarity": "PARSED", "response": "Intent received and routed to the Core boundary.", "next": "MODEL_ADAPTER_REQUIRED_FOR_GENERATIVE_RESPONSE"}

    def system_status(self) -> str:
        return f"{self.system_name} is active with {len(self.active_entities)} registered entities and EventBus integrated."
