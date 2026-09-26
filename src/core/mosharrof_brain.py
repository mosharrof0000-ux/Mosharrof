"""Mosharrof Core Brain: model-agnostic coordination layer."""
from typing import Dict, Any, Optional
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.permission_policy import PermissionPolicy

class MosharrofCoreBrain:
    def __init__(self, event_bus: Optional[EcosystemEventBus]=None,
                 memory_ledger: Optional[MemoryLedger]=None,
                 permission_policy: Optional[PermissionPolicy]=None):
        self.system_name="Mosharrof AI Core"
        self.consciousness_state="ACTIVE"
        self.security_protocol="DELETE_AND_DESTRUCTIVE_DENIED"
        self.event_bus=event_bus or EcosystemEventBus()
        self.memory_ledger=memory_ledger or MemoryLedger()
        self.permission_policy=permission_policy or PermissionPolicy(
            {"READ","WRITE","UPDATE","CREATE","EXECUTE","MOVE"}
        )
        self.active_entities=["mosharrof-core"]

    def broadcast_system_command(self, command_type: str, payload: Dict[str, Any]):
        self.event_bus.publish(command_type,payload)
        self.memory_ledger.record_event("SYSTEM_COMMAND",{"command_type":command_type,"payload":payload})

    def monitor_sub_agent(self, entity_name: str, action_report: Dict[str, Any])->Dict[str, Any]:
        if action_report.get("status")=="PROCESSING":
            return {"decision":"APPROVED","master_command":f"Proceed within declared policy for {entity_name}.","integrity_check":"PASSED"}
        return {"decision":"REJECTED","master_command":"Policy or action state did not permit execution.","integrity_check":"FAILED"}

    def process_intent(self, intent: str)->Dict[str, Any]:
        text=str(intent).strip()
        if not text:
            return {"status":"EMPTY","intent_clarity":0.0,"intent":""}
        self.memory_ledger.record_event("INTENT_RECEIVED",{"intent":text})
        return {"status":"SUCCESS","intent":text,"intent_clarity":1.0}

    def check_permission(self, operation: str)->Dict[str, Any]:
        return self.permission_policy.check(operation)

    def system_status(self)->str:
        return f"{self.system_name} is active with {len(self.active_entities)} registered core entity/entities."
