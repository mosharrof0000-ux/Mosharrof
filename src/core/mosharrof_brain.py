"""
Mosharrof Core Brain
Model-agnostic coordination brain. Capability is bounded by identity, permission,
policy, scope and assigned tools.
"""
from typing import Dict, Any, Optional
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.permission_guard import PermissionGuard

class MosharrofCoreBrain:
    def __init__(self,event_bus:Optional[EcosystemEventBus]=None,
                 memory_ledger:Optional[MemoryLedger]=None,
                 permission_guard:Optional[PermissionGuard]=None):
        self.system_name="Mosharrof Core"
        self.consciousness_state="ACTIVE"
        self.security_protocol="NO_DELETE"
        self.event_bus=event_bus or EcosystemEventBus()
        self.memory_ledger=memory_ledger or MemoryLedger()
        self.permission_guard=permission_guard or PermissionGuard()
        self.active_entities=["core","chat","sidebar","quran_research"]

    def authorize_action(self, *, entity_id: str, operation: str, scope: str = "") -> Dict[str, Any]:
        permission = self.permission_guard.check(
            operation, scope=scope or entity_id, entity_scope=entity_id
        )
        if permission["status"] == "DENIED":
            self.memory_ledger.record_event("ACTION_DENIED", permission)
            return permission
        result={"status":"ALLOWED","entity":entity_id,
                "operation":operation.upper(),"scope":scope}
        self.memory_ledger.record_event("ACTION_ALLOWED",result)
        return result

    def broadcast_system_command(self,command_type:str,payload:Dict[str,Any]):
        self.event_bus.publish(command_type,payload)
        self.memory_ledger.record_event(command_type,payload)

    def monitor_sub_agent(self,entity_name:str,action_report:Dict[str,Any])->Dict[str,Any]:
        permission=self.permission_guard.check(
            action_report.get("operation","PROCESS"),
            scope=action_report.get("scope",entity_name),
            entity_scope=action_report.get("entity_scope",entity_name),
            destructive=bool(action_report.get("destructive",False)))
        if permission["status"]=="DENIED":
            result={"decision":"REJECTED","entity":entity_name,
                    "integrity_check":"FAILED","reason":permission["reason"]}
        elif action_report.get("status")=="PROCESSING":
            result={"decision":"APPROVED","entity":entity_name,
                    "integrity_check":"PASSED","reason":"Within declared scope"}
        else:
            result={"decision":"REJECTED","entity":entity_name,
                    "integrity_check":"FAILED","reason":"Policy or state check failed"}
        self.memory_ledger.record_event("ENTITY_ACTION_REVIEWED",result)
        return result

    def process_intent(self,text:str)->Dict[str,Any]:
        text=(text or "").strip()
        if not text:
            return {"status":"EMPTY","intent":"UNKNOWN","intent_clarity":0.0}
        lowered=text.lower()
        intent="GENERAL"
        if any(k in lowered for k in ("quran","কুরআন","কোরআন")): intent="RESEARCH"
        elif any(k in lowered for k in ("file","ফাইল","folder","ফোল্ডার")): intent="STORAGE"
        elif any(k in lowered for k in ("tool","টুল")): intent="TOOL"
        result={"status":"SUCCESS","intent":intent,"intent_clarity":1.0,"text":text}
        self.memory_ledger.record_event("INTENT_PROCESSED",result)
        return result

    def system_status(self)->Dict[str,Any]:
        return {"system":self.system_name,"state":self.consciousness_state,
                "entities":list(self.active_entities),"delete_operations":"BLOCKED"}
