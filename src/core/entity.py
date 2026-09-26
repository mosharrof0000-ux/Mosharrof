from dataclasses import dataclass, field
from typing import Any, Dict, List

@dataclass
class Entity:
    entity_id: str
    name: str
    responsibility: str
    brain_id: str
    permission_profile: str
    status: str = "registered"
    memory: List[Dict[str, Any]] = field(default_factory=list)

    def record(self, event: str, data: Dict[str, Any]) -> None:
        self.memory.append({"event": event, "data": data})

    def manifest(self) -> Dict[str, Any]:
        return {
            "entity_id": self.entity_id,
            "name": self.name,
            "responsibility": self.responsibility,
            "brain_id": self.brain_id,
            "permission_profile": self.permission_profile,
            "status": self.status
        }
