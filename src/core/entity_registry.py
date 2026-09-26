"""Validated loader for Mosharrof's machine-readable entity registry."""
import json
from pathlib import Path
from typing import Any, Dict


class EntityRegistry:
    def __init__(self, path: str = "config/entity_registry.json"):
        self.path = Path(path)
        self.data: Dict[str, Any] = self._load()

    def _load(self) -> Dict[str, Any]:
        data = json.loads(self.path.read_text(encoding="utf-8"))
        entities = data.get("entities")
        if not isinstance(entities, list):
            raise ValueError("ENTITY_REGISTRY_ENTITIES_MUST_BE_LIST")
        ids = [item.get("id") for item in entities]
        if len(ids) != len(set(ids)):
            raise ValueError("DUPLICATE_ENTITY_ID")
        required = {"id", "type", "responsibility", "scope", "permission_profile"}
        for entity in entities:
            missing = required - entity.keys()
            if missing:
                raise ValueError(f"ENTITY_MISSING_FIELDS:{','.join(sorted(missing))}")
            if entity.get("delete_allowed", False):
                raise ValueError("DELETE_PERMISSION_IS_FORBIDDEN")
        return data

    def get(self, entity_id: str) -> Dict[str, Any]:
        for entity in self.data["entities"]:
            if entity["id"] == entity_id:
                return entity
        raise KeyError(entity_id)

    def list_ids(self) -> list[str]:
        return [entity["id"] for entity in self.data["entities"]]
