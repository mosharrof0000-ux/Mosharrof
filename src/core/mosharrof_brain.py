"""
Mosharrof Core Brain.

Deterministic foundation only: provider-specific AI models are connected through
an adapter layer later. Permissions and policies remain outside the model.
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
        self.consciousness_state = "FOUNDATION_ACTIVE"
        self.security_protocol = "DELETE_AND_DESTRUCTIVE_OPERATIONS_DENIED"
        self.event_bus = event_bus or EcosystemEventBus()
        self.memory_ledger = memory_ledger or MemoryLedger()
        self.active_entities = ["mosharrof.core"]

    def broadcast_system_command(self, command_type: str, payload: Dict[str, Any]):
        self.event_bus.publish(command_type, payload)
        self.memory_ledger.record_event(
            "SYSTEM_COMMAND_BROADCAST",
            {"command_type": command_type, "payload": payload},
        )

    def monitor_sub_agent(self, entity_name: str, action_report: Dict[str, Any]) -> Dict[str, Any]:
        allowed = action_report.get("status") == "PROCESSING"
        result = {
            "decision": "APPROVED" if allowed else "REJECTED",
            "master_command": (
                f"Proceed within declared scope for {entity_name}."
                if allowed
                else "Policy or state check failed."
            ),
            "integrity_check": "PASSED" if allowed else "FAILED",
        }
        self.memory_ledger.record_event(
            "ENTITY_ACTION_REVIEWED",
            {"entity": entity_name, "action_report": action_report, "result": result},
        )
        return result

    def process_intent(self, text: str) -> Dict[str, Any]:
        """Return a deterministic routing result until an AI model adapter is connected."""
        clean = (text or "").strip()
        if not clean:
            return {"status": "EMPTY", "intent": "unknown", "intent_clarity": "0%"}
        intent = "general_request"
        lowered = clean.lower()
        if any(word in lowered for word in ("file", "folder", "storage")):
            intent = "storage_request"
        elif any(word in lowered for word in ("tool", "agent", "entity", "brain")):
            intent = "ecosystem_request"
        result = {
            "status": "SUCCESS",
            "intent": intent,
            "intent_clarity": "100%",
            "model_mode": "deterministic-foundation",
        }
        self.memory_ledger.record_event("INTENT_PROCESSED", {"text": clean, "result": result})
        return result

    def system_status(self) -> str:
        return (
            f"{self.system_name} is active with "
            f"{len(self.active_entities)} registered core entity/entities."
        )
