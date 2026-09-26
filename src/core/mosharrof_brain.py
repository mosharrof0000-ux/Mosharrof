"""
Mosharrof Core Brain
Model-agnostic orchestration layer. Policy and permissions remain the hard boundary.
"""
from typing import Dict, Any
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger

class MosharrofCoreBrain:
    def __init__(self, event_bus: EcosystemEventBus = None, memory_ledger: MemoryLedger = None):
        self.system_name = "Mosharrof AI Core"
        self.consciousness_state = "SUPREME_GOVERNANCE"
        self.security_protocol = "NO_DELETE"
        self.event_bus = event_bus or EcosystemEventBus()
        self.memory_ledger = memory_ledger or MemoryLedger()
        self.active_entities = ["mosharrof.core"]
        self.denied_operations = {"DELETE", "DESTRUCTIVE"}

    def is_allowed(self, operation: str) -> bool:
        return operation.upper() not in self.denied_operations

    def broadcast_system_command(self, command_type: str, payload: Dict[str, Any]):
        self.memory_ledger.record_event("SYSTEM_COMMAND", {"type": command_type, "payload": payload})
        self.event_bus.publish(command_type, payload)

    def monitor_sub_agent(self, entity_name: str, action_report: Dict[str, Any]) -> Dict[str, Any]:
        operation = str(action_report.get("operation", "READ")).upper()
        if not self.is_allowed(operation):
            return {"decision": "REJECTED", "reason": "DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED"}
        if action_report.get("status") == "PROCESSING":
            return {"decision": "APPROVED", "master_command": f"Proceed within scope for {entity_name}.", "integrity_check": "PASSED"}
        return {"decision": "REJECTED", "master_command": "Action is not ready for execution.", "integrity_check": "FAILED"}

    def process_intent(self, intent: str) -> Dict[str, Any]:
        text = str(intent).strip()
        if not text:
            return {"status": "EMPTY", "intent_clarity": "0%"}
        self.memory_ledger.record_event("INTENT_RECEIVED", {"intent": text})
        return {"status": "SUCCESS", "intent": text, "intent_clarity": "100%"}

    def system_status(self) -> str:
        return f"{self.system_name} is active with {len(self.active_entities)} registered core entities and EventBus integrated."
