import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def test_awareness_contract_exists():
    policy = json.loads((ROOT / "config/entity_awareness.json").read_text(encoding="utf-8"))
    assert policy["enabled"] is True
    assert policy["safety"]["delete_allowed"] is False
    assert policy["behavior"]["automatic_repair"] is False

def test_all_registered_entities_are_operationally_aware():
    result = subprocess.run(
        [sys.executable, "scripts/entity_awareness.py"],
        cwd=ROOT, check=True, capture_output=True, text=True
    )
    report = json.loads(result.stdout)
    assert report["entity_count"] >= 1
    assert report["degraded_count"] == 0
    assert report["ready_count"] == report["entity_count"]

def test_entity_registry_has_no_delete_permission():
    registry = json.loads((ROOT / "config/entity_registry.json").read_text(encoding="utf-8"))
    assert registry["entities"]
    assert all(entity.get("delete_allowed") is False for entity in registry["entities"])
