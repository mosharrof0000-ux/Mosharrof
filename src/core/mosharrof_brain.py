from typing import Any, Dict
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.model_adapter import ModelAdapter
from src.core.policy import CapabilityPolicy

class MosharrofCoreBrain:
    """Central coordinator; child entities retain their own capability boundaries."""
    def __init__(self, event_bus=None, memory_ledger=None):
        self.system_name = "Mosharrof AI Core"
        self.consciousness_state = "ACTIVE"
        self.security_protocol = "DELETE_BLOCKED"
        self.event_bus = event_bus or EcosystemEventBus()
        self.memory_ledger = memory_ledger or MemoryLedger()
        self.model = ModelAdapter()
        self.policy = CapabilityPolicy()
        self.active_entities = ["core", "web-console"]

    def broadcast_system_command(self, command_type: str, payload: Dict[str, Any]):
        self.policy.check("EXECUTE")
        self.event_bus.publish(command_type, payload)
        self.memory_ledger.record_event(command_type, payload)

    def monitor_sub_agent(self, entity_name: str, action_report: Dict[str, Any]):
        if action_report.get("status") == "PROCESSING":
            return {"decision":"APPROVED","entity":entity_name,"integrity_check":"PASSED"}
        return {"decision":"REJECTED","entity":entity_name,"integrity_check":"FAILED"}

    def process_intent(self, intent: str) -> Dict[str, Any]:
        if not intent or not intent.strip():
            return {"status":"EMPTY","intent_clarity":"0%"}
        self.memory_ledger.record_event("INTENT_RECEIVED", {"text":intent})
        return {"status":"SUCCESS","intent_clarity":"100%","intent":intent.strip()}

    def system_status(self) -> str:
        return f"{self.system_name} active; entities={len(self.active_entities)}; delete=blocked"
