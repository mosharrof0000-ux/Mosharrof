"""
Mosharrof Core Brain
Central orchestration layer. Model execution is adapter-ready.
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

    def broadcast_system_command(self, command_type: str, payload: Dict[str, Any]):
        self.event_bus.publish(command_type, payload)
        self.memory_ledger.record_event("SYSTEM_COMMAND",
            {"command_type": command_type, "payload": payload})

    def monitor_sub_agent(self, entity_name: str, action_report: Dict[str, Any]) -> Dict[str, Any]:
        decision = "APPROVED" if action_report.get("status") == "PROCESSING" else "REJECTED"
        result = {"decision": decision, "entity": entity_name,
                  "integrity_check": "PASSED" if decision == "APPROVED" else "FAILED"}
        self.memory_ledger.record_event("ENTITY_DECISION", result)
        return result

    def process_intent(self, text: str) -> Dict[str, Any]:
        cleaned = text.strip()
        if not cleaned:
            return {"status": "EMPTY", "intent": "UNKNOWN", "intent_clarity": 0.0}
        lowered = cleaned.lower()
        if any(w in lowered for w in ("ফাইল","file","folder","ফোল্ডার")):
            intent = "STORAGE"
        elif any(w in lowered for w in ("টুল","tool")):
            intent = "TOOL"
        elif any(w in lowered for w in ("ভয়েস","voice","কথা")):
            intent = "VOICE"
        else:
            intent = "GENERAL"
        result = {"status":"SUCCESS","intent":intent,"intent_clarity":1.0,"input":cleaned}
        self.memory_ledger.record_event("INTENT_PROCESSED", result)
        return result

    def system_status(self) -> Dict[str, Any]:
        return {"system":self.system_name,"state":self.consciousness_state,
                "security_protocol":self.security_protocol,
                "active_entities":len(self.active_entities)}
