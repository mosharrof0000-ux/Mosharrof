from typing import Any, Dict, Optional
from src.core.event_bus import EcosystemEventBus
from src.core.permissions import PermissionGate

class MosharrofCoreBrain:
    def __init__(self, event_bus: Optional[EcosystemEventBus] = None, memory_ledger=None):
        self.system_name = "Mosharrof AI Core"
        self.version = "1.0"
        self.consciousness_state = "ACTIVE"
        self.security_protocol = "NO_DELETE"
        self.event_bus = event_bus or EcosystemEventBus()
        self.memory_ledger = memory_ledger
        self.active_entities = ["mosharrof.core"]
        self.permission_gate = PermissionGate({"READ","CREATE","UPDATE","EXECUTE","COMMUNICATE","AUDIT"})

    def process_intent(self, intent: str) -> Dict[str, Any]:
        text = (intent or "").strip()
        if not text:
            return {"status": "EMPTY", "intent": None, "intent_clarity": "0%"}
        result = {"status": "SUCCESS", "intent": text, "intent_clarity": "LOCAL_RULE_CONFIRMED", "next_step": "ROUTE_TO_REGISTERED_ENTITY"}
        if self.memory_ledger:
            self.memory_ledger.record_event("INTENT_RECEIVED", result)
        return result

    def authorize(self, operation: str) -> Dict[str, Any]:
        decision = self.permission_gate.check(operation)
        return {"status": "ALLOWED" if decision.allowed else "DENIED", "reason": decision.reason}

    def broadcast_system_command(self, command_type: str, payload: Dict[str, Any]):
        self.event_bus.publish(command_type, payload)

    def monitor_sub_agent(self, entity_name: str, action_report: Dict[str, Any]) -> Dict[str, Any]:
        if action_report.get("status") == "PROCESSING":
            return {"decision": "APPROVED", "entity": entity_name, "integrity_check": "PASSED"}
        return {"decision": "REJECTED", "entity": entity_name, "integrity_check": "FAILED"}

    def system_status(self) -> str:
        return f"{self.system_name} v{self.version} is active; no-delete policy enforced."
