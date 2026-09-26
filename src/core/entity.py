"""Independent entity contract."""
from dataclasses import dataclass,field
from typing import Any,Dict,List
from .model_adapter import ModelAdapter
from .policy import CapabilityPolicy
@dataclass
class Entity:
    entity_id:str; name:str; responsibility:str; brain:ModelAdapter=field(default_factory=ModelAdapter); policy:CapabilityPolicy=field(default_factory=CapabilityPolicy); memory:List[Dict[str,Any]]=field(default_factory=list); version:str="1.0.0"
    def remember(self,event:str,data:Dict[str,Any]): self.memory.append({"event":event,"data":data})
    def act(self,operation:str,payload:Dict[str,Any]|None=None): self.policy.check(operation); self.remember(operation,payload or {}); return {"status":"APPROVED","entity":self.entity_id,"operation":operation}
