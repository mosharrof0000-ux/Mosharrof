"""First-read project map loader and structural validator."""
import json
from pathlib import Path
from typing import Any, Dict

class ProjectMap:
    def __init__(self, root: str = "."):
        self.root = Path(root)

    def load(self) -> Dict[str, Any]:
        manifest = self._load_json("config/project_manifest.json")
        registry = self._load_json("config/entity_registry.json")
        return {"manifest": manifest, "entities": registry.get("entities", [])}

    def validate(self) -> Dict[str, Any]:
        data = self.load()
        errors = []
        manifest = data["manifest"]
        if manifest.get("project_id") != "mosharrof.core":
            errors.append("INVALID_PROJECT_ID")
        safety = manifest.get("immutable_safety_rules", {})
        if safety.get("delete") is not False:
            errors.append("DELETE_RULE_NOT_LOCKED")
        if safety.get("destructive_operations") is not False:
            errors.append("DESTRUCTIVE_RULE_NOT_LOCKED")
        for entity in data["entities"]:
            required = ("id", "name", "responsibility", "brain", "scope")
            if not all(entity.get(k) for k in required):
                errors.append(f"INCOMPLETE_ENTITY:{entity.get('id', 'UNKNOWN')}")
            if entity.get("delete_allowed") is not False:
                errors.append(f"DELETE_NOT_BLOCKED:{entity.get('id', 'UNKNOWN')}")
        return {"valid": not errors, "errors": errors, "entity_count": len(data["entities"])}

    def _load_json(self, relative_path: str) -> Dict[str, Any]:
        with (self.root / relative_path).open("r", encoding="utf-8") as handle:
            return json.load(handle)
