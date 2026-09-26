"""Machine-readable entity registry with responsibility and scope boundaries."""

from dataclasses import dataclass, asdict
from typing import Dict, Any


@dataclass(frozen=True)
class EntityDefinition:
    entity_id: str
    name: str
    entity_type: str
    responsibility: str
    scope: str
    permission_profile: str
    brain_adapter: str = "model-agnostic"


class EntityRegistry:
    def __init__(self):
        self._entities: Dict[str, EntityDefinition] = {}

    def register(self, entity: EntityDefinition) -> Dict[str, Any]:
        if entity.entity_id in self._entities:
            return {"status": "REJECTED", "reason": "ENTITY_ID_ALREADY_REGISTERED"}
        self._entities[entity.entity_id] = entity
        return {"status": "REGISTERED", "entity_id": entity.entity_id}

    def get(self, entity_id: str):
        return self._entities.get(entity_id)

    def manifest(self) -> Dict[str, Any]:
        return {"entities": [asdict(e) for e in self._entities.values()]}
