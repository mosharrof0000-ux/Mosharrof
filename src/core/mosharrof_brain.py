"""
Mosharrof Core Brain
Model-agnostic coordination brain. Capability is bounded by identity, permission,
policy, scope and assigned tools.
"""
from typing import Dict, Any, Optional
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger

class MosharrofCoreBrain:
    def __init__(
        self,
        event_bus: Optional[EcosystemEventBus] = None,
        memory_ledger: Optional[MemoryLedger] = None,
    ):
        self.system_name = "Mosharrof Core"
        self.consciousness_state = "ACTIVE"
        self.security_protocol = "NO_DELETE"
        self.event_bus = event_bus or EcosystemEventBus()
        self.memory_ledger = memory_ledger or MemoryLedger()
        self.active_entities = ["core", "chat", "sidebar", "quran_research"]

    def broadcast_system_command(self, command_type: str, payload: Dict[str, Any]):
        self.event_bus.publish(command_type, payload)
        self.memory_ledger.record_event(command_type, payload)

    def monitor_sub_agent(self, entity_name: str, action_report: Dict[str, Any]) -> Dict[str, Any]:
        allowed = action_report.get("status") == "PROCESSING"
        return {
            "decision": "APPROVED" if allowed else "REJECTED",
            "entity": entity_name,
            "integrity_check": "PASSED" if allowed else "FAILED",
            "reason": "Within declared scope" if allowed else "Policy or state check failed",
        }

    def process_intent(self, text: str) -> Dict[str, Any]:
        text = (text or "").strip()
        if not text:
            return {"status": "EMPTY", "intent": "UNKNOWN", "intent_clarity": 0.0}
        lowered = text.lower()
        intent = "GENERAL"
        if any(k in lowered for k in ("file", "ফাইল", "folder", "ফোল্ডার")):
            intent = "STORAGE"
        elif any(k in lowered for k in ("tool", "টুল")):
            intent = "TOOL"
        elif any(k in lowered for k in ("quran", "কুরআন", "কোরআন")):
            intent = "RESEARCH"
        result = {
            "status": "SUCCESS",
            "intent": intent,
            "intent_clarity": 1.0,
            "text": text,
        }
        self.memory_ledger.record_event("INTENT_PROCESSED", result)
        return result

    def system_status(self) -> Dict[str, Any]:
        return {
            "system": self.system_name,
            "state": self.consciousness_state,
            "entities": list(self.active_entities),
            "delete_operations": "BLOCKED",
        }
