"""
Mosharrof Core Brain
The central coordination layer. Model-specific intelligence is intentionally
kept behind an adapter boundary so the Core identity and policies can persist
when the underlying model changes.
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
        self.system_name = "Mosharrof AI Core"
        self.consciousness_state = "ACTIVE"
        self.security_protocol = "NO_DELETE_BY_POLICY"
        self.event_bus = event_bus or EcosystemEventBus()
        self.memory_ledger = memory_ledger or MemoryLedger()
        self.active_entities = []

    def broadcast_system_command(self, command_type: str, payload: Dict[str, Any]):
        self.event_bus.publish(command_type, payload)

    def monitor_sub_agent(
        self, entity_name: str, action_report: Dict[str, Any]
    ) -> Dict[str, Any]:
        status = action_report.get("status")
        if status == "PROCESSING":
            return {
                "decision": "APPROVED",
                "master_command": f"Proceed with scoped behavior for {entity_name}.",
                "integrity_check": "PASSED",
            }
        return {
            "decision": "REJECTED",
            "master_command": "Policy or state check failed.",
            "integrity_check": "FAILED",
        }

    def process_intent(self, user_text: str) -> Dict[str, Any]:
        """Provide a deterministic baseline intent contract until a model adapter is attached."""
        text = (user_text or "").strip()
        if not text:
            return {
                "status": "EMPTY",
                "intent": "UNKNOWN",
                "requested_action": None,
                "intent_clarity": 0.0,
                "clarity_method": "BASELINE_RULES",
            }

        lowered = text.lower()
        if any(word in lowered for word in ("file", "folder", "ফাইল", "ফোল্ডার", "গুছ")):
            intent = "ORGANIZE_STORAGE"
        else:
            intent = "GENERAL_REQUEST"

        result = {
            "status": "SUCCESS",
            "intent": intent,
            "requested_action": text,
            "intent_clarity": 1.0,
            "clarity_method": "BASELINE_RULES",
        }
        self.memory_ledger.record_event("INTENT_PROCESSED", result)
        return result

    def system_status(self) -> str:
        return (
            f"{self.system_name} is active with "
            f"{len(self.active_entities)} registered active entities."
        )
