"""Machine-readable entity registry backed by config/entity_registry.json."""
import json
from pathlib import Path


class EntityRegistry:
    def __init__(self, registry_path: str = "config/entity_registry.json"):
        self.path = Path(registry_path)
        data = json.loads(self.path.read_text(encoding="utf-8"))
        self._entities = {entity["id"]: entity for entity in data["entities"]}

    def register(self, entity_id, *, role, brain, scope, permissions=None):
        self._entities[entity_id] = {
            "id": entity_id,
            "name": entity_id,
            "responsibility": role,
            "brain": brain,
            "scope": scope,
            "permissions": permissions or [],
            "delete_allowed": False,
        }

    def get(self, entity_id):
        return self._entities.get(entity_id)

    def list(self):
        return list(self._entities.values())
