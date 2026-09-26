import json
from pathlib import Path
from typing import Dict
from src.core.entity import Entity

class EntityRegistry:
    def __init__(self, path: str = "registry/entity_registry.json"):
        self.path = Path(path)
        self.entities: Dict[str, Entity] = {}

    def load(self) -> None:
        data = json.loads(self.path.read_text(encoding="utf-8"))
        for item in data.get("entities", []):
            self.entities[item["entity_id"]] = Entity(**{
                key: item[key]
                for key in ("entity_id", "name", "responsibility", "brain_id", "permission_profile")
            }, status=item.get("status", "registered"))

    def get(self, entity_id: str) -> Entity:
        return self.entities[entity_id]

    def list(self):
        return list(self.entities.values())
