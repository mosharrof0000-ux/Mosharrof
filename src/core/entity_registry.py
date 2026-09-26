"""Machine-readable registry for Mosharrof entities."""
import json
from pathlib import Path
from typing import Any, Dict

class EntityRegistry:
    def __init__(self, manifest_path: str = "project/entities/registry.json"):
        self.manifest_path = Path(manifest_path)

    def load(self) -> Dict[str, Any]:
        return json.loads(self.manifest_path.read_text(encoding="utf-8"))

    def get(self, entity_id: str) -> Dict[str, Any]:
        for entity in self.load().get("entities", []):
            if entity["id"] == entity_id:
                return entity
        raise KeyError(entity_id)

    def list_ids(self) -> list[str]:
        return [entity["id"] for entity in self.load().get("entities", [])]
