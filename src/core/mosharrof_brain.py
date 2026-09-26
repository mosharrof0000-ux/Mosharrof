"""
Mosharrof Core Brain.

The core coordinates registered entities. It does not bypass their declared
scope or policy boundaries.
"""

from typing import Any, Dict, Optional
from src.core.event_bus import EcosystemEventBus


class MosharrofCoreBrain:
    def __init__(
        self,
        event_bus: Optional[EcosystemEventBus] = None,
        memory_ledger: Any = None,
    ):
        self.system_name = "Mosharrof AI Core"
        self.consciousness_state = "ACTIVE"
        self.security_protocol = "DELETE_AND_DESTRUCTIVE_DENY"
        self.event_bus = event_bus or EcosystemEventBus()
        self.memory_ledger = memory_ledger
        self.active_entities = [
            "mosharrof.core",
            "mosharrof.tool_factory",
        ]

    def broadcast_system_command(
        self, command_type: str, payload: Dict[str, Any]
    ) -> None:
        self.event_bus.publish(command_type, payload)
        if self.memory_ledger is not None:
            self.memory_ledger.record_event(
                "SYSTEM_COMMAND_BROADCAST",
                {"command_type": command_type, "payload": payload},
            )

    def process_intent(self, intent: str) -> Dict[str, Any]:
        """Deterministic boundary classification; model adapters can replace it later."""
        normalized = (intent or "").strip()
        if not normalized:
            return {"status": "EMPTY", "intent": None, "intent_clarity": "0%"}

        lowered = normalized.lower()
        if any(word in lowered for word in ("delete", "destroy", "remove", "মুছে")):
            intent_type = "DESTRUCTIVE_ACTION_REQUEST"
            clarity = "100%"
        elif any(word in lowered for word in ("file", "folder", "গুছ", "ফাইল", "ফোল্ডার")):
            intent_type = "STORAGE_ORGANIZATION"
            clarity = "100%"
        else:
            intent_type = "GENERAL_REQUEST"
            clarity = "80%"

        result = {
            "status": "SUCCESS",
            "intent": intent_type,
            "intent_clarity": clarity,
            "requires_policy_check": True,
        }
        if self.memory_ledger is not None:
            self.memory_ledger.record_event("INTENT_PROCESSED", result)
        return result

    def monitor_sub_agent(
        self, entity_name: str, action_report: Dict[str, Any]
    ) -> Dict[str, Any]:
        if action_report.get("operation") in {"DELETE", "DESTRUCTIVE"}:
            return {
                "decision": "REJECTED",
                "master_command": "Permanent safety policy denied the operation.",
                "integrity_check": "FAILED",
            }

        if action_report.get("status") == "PROCESSING":
            return {
                "decision": "APPROVED",
                "master_command": f"Proceed within declared scope for {entity_name}.",
                "integrity_check": "PASSED",
            }

        return {
            "decision": "REJECTED",
            "master_command": "Action was not in an approved processing state.",
            "integrity_check": "FAILED",
        }

    def system_status(self) -> str:
        return (
            f"{self.system_name} is active with "
            f"{len(self.active_entities)} registered foundation entities "
            f"and EventBus integrated."
        )
