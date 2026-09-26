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
        return self.data["project"]["id"]

    @property
    def project_name(self) -> str:
        return self.data["project"]["name"]

    def summary(self) -> Dict[str, Any]:
        return {
            "project": self.data["project"],
            "core": self.data["core"],
            "architecture": self.data["architecture"],
            "registries": self.data["registries"],
        }
