"""Automated tests for configuration manifest integrity."""

import json
from pathlib import Path

CONFIG_DIR = Path(__file__).resolve().parents[1] / "config"


def test_config_json_files_are_valid():
    json_files = list(CONFIG_DIR.glob("*.json"))
    assert len(json_files) > 0, "Config directory should contain JSON files"
    for json_file in json_files:
        content = json_file.read_text(encoding="utf-8")
        data = json.loads(content)
        assert isinstance(data, dict), f"{json_file.name} must be a JSON object"


def test_project_manifest_structure():
    manifest_path = CONFIG_DIR / "project_manifest.json"
    assert manifest_path.is_file(), "project_manifest.json must exist"
    data = json.loads(manifest_path.read_text(encoding="utf-8"))
    assert "schema_version" in data
    assert "project_id" in data
    assert data["project_id"] == "mosharrof.core"
