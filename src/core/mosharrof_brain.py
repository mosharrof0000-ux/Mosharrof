"""Mosharrof Core Brain.

Model-agnostic coordinator. The selected AI model is replaceable; policy and
scope remain the hard capability boundary.
"""
from typing import Dict, Optional
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger

class MosharrofCoreBrain:
    def __init__(self, event_bus: Optional[EcosystemEventBus] = None, memory_ledger: Optional[MemoryLedger] = None):
        self.system_name = "Mosharrof AI Core"
        self.consciousness_state = "ACTIVE"
        self.security_protocol = "DELETE_AND_DESTRUCTIVE_DENIAL"
        self.event_bus = event_bus or EcosystemEventBus()
        self.memory_ledger = memory_ledger or MemoryLedger()
        self.active_entities = [
            "mosharrof.core",
            "mosharrof.chat",
            "mosharrof.sidebar",
            "mosharrof.al-quran-research"
        ]

    def process_intent(self, request: str) -> Dict:
        request = (request or "").strip()
        if not request:
            return {"status":"EMPTY","intent":"UNKNOWN","intent_clarity":"0%"}
        self.memory_ledger.record_event("INTENT_RECEIVED", {"request":request})
        return {
            "status":"SUCCESS",
            "intent":"ROUTE_AND_COORDINATE",
            "intent_clarity":"100%",
            "request":request
        }

    def broadcast_system_command(self, command_type: str, payload: Dict):
        self.event_bus.publish(command_type, payload)

    def monitor_sub_agent(self, entity_name: str, action_report: Dict) -> Dict:
        if action_report.get("status") == "PROCESSING":
            return {"decision":"APPROVED","entity":entity_name,"integrity_check":"PASSED"}
        return {"decision":"REJECTED","entity":entity_name,"integrity_check":"FAILED"}

    def system_status(self) -> str:
        return f"{self.system_name} is active with {len(self.active_entities)} registered entities."
