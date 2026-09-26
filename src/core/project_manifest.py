"""Project manifest loader used for fast system understanding by new agents."""
import json
from pathlib import Path
from typing import Any, Dict


class ProjectManifest:
    def __init__(self, manifest_path: str = "config/project_manifest.json"):
        self.path = Path(manifest_path)
        self.data: Dict[str, Any] = json.loads(self.path.read_text(encoding="utf-8"))

    @property
    def project_id(self) -> str:
        return self.data["project_id"]

    @property
    def project_name(self) -> str:
        return self.data["name"]

    def summary(self) -> Dict[str, Any]:
        return {
            "project_id": self.data["project_id"],
            "name": self.data["name"],
            "owner": self.data["owner"],
            "role": self.data["role"],
            "architecture": self.data["architecture"],
            "first_read": self.data["first_read"],
            "entity_lifecycle": self.data["entity_lifecycle"],
        }
