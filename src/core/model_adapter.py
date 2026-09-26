"""Model-agnostic brain adapter boundary."""
from dataclasses import dataclass
from typing import Any, Dict
@dataclass
class ModelAdapter:
    provider: str="runtime"; model: str="runtime-selected"
    def describe(self)->Dict[str,str]: return {"provider":self.provider,"model":self.model}
    def respond(self,prompt:str,context:Dict[str,Any]|None=None)->Dict[str,Any]: return {"status":"READY","prompt":prompt,"context":context or {},"model":self.describe()}
