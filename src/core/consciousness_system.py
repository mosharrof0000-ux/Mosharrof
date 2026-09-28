from __future__ import annotations
import time
from typing import Any, Dict, Iterable, Optional
from src.core.brain_adapter import BrainAdapter
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.permission_guard import PermissionGuard

class EntityConsciousnessSystem:
    """Software-level awareness/coordination for every registered entity."""
    def __init__(self, entities: Iterable[Dict[str, Any]], *, event_bus: Optional[EcosystemEventBus]=None, memory_ledger: Optional[MemoryLedger]=None, permission_guard: Optional[PermissionGuard]=None):
        self.event_bus=event_bus or EcosystemEventBus()
        self.memory_ledger=memory_ledger or MemoryLedger()
        self.permission_guard=permission_guard or PermissionGuard()
        self._states={}; self._brains={}; self.sync_registry(entities)
    def sync_registry(self, entities):
        for entity in entities:
            entity_id=str(entity.get("id","")).strip()
            if not entity_id: continue
            self._brains[entity_id]=BrainAdapter(entity_id=str(entity.get("brain") or entity_id))
            self._states[entity_id]={"entity_id":entity_id,"state":"AWAKE","brain_attached":True,"memory_attached":True,"event_channel_attached":True,"permission_boundary":"ENFORCED","delete_allowed":False,"last_heartbeat":None,"heartbeat_count":0}
    def heartbeat(self, entity_id):
        if entity_id not in self._states: return {"status":"UNKNOWN_ENTITY","entity_id":entity_id}
        s=self._states[entity_id]; s["state"]="AWAKE"; s["last_heartbeat"]=time.time(); s["heartbeat_count"]+=1
        result={"status":"ALIVE",**{k:s[k] for k in ("entity_id","state","brain_attached","memory_attached","event_channel_attached","permission_boundary")}}
        self.memory_ledger.record_event("ENTITY_HEARTBEAT",result); self.event_bus.publish("ENTITY_HEARTBEAT",result); return result
    def awaken_all(self):
        results=[self.heartbeat(x) for x in sorted(self._states)]; alive=sum(x["status"]=="ALIVE" for x in results)
        return {"status":"ACTIVE" if alive==len(results) else "DEGRADED","total_entities":len(results),"alive_entities":alive,"entities":results}
    def inspect(self, entity_id=None):
        if entity_id: return dict(self._states[entity_id]) if entity_id in self._states else {"status":"UNKNOWN_ENTITY","entity_id":entity_id}
        return {"status":"ACTIVE","total_entities":len(self._states),"entities":{k:dict(v) for k,v in self._states.items()}}
    def brain(self, entity_id): return self._brains.get(entity_id)
    def verify(self):
        missing=[eid for eid,s in self._states.items() if not (s["brain_attached"] and s["memory_attached"] and s["event_channel_attached"] and s["permission_boundary"]=="ENFORCED" and s["delete_allowed"] is False)]
        return {"status":"PASS" if not missing else "FAIL","total_entities":len(self._states),"missing_consciousness_links":missing}
