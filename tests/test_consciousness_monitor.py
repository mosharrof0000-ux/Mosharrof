"""Tests for entity consciousness/awareness coverage."""
import json
from pathlib import Path

from src.core.consciousness_monitor import EntityConsciousnessMonitor


ROOT = Path(__file__).resolve().parents[1]


def test_every_registered_entity_is_structurally_aware():
    registry = json.loads(
        (ROOT / "config" / "entity_registry.json").read_text(encoding="utf-8")
    )
    report = EntityConsciousnessMonitor(registry["entities"]).scan()
    assert report["state"] == "AWARE"
    assert report["entity_count"] == len(registry["entities"])
    assert report["aware_count"] == report["entity_count"]
    assert report["degraded_count"] == 0
    assert report["runtime_provider_attached"] is False


def test_missing_brain_is_degraded_not_falsely_injected():
    entity = {
        "id": "example",
        "scope": "example/*",
        "permission_profile": "ui",
        "delete_allowed": False,
    }
    report = EntityConsciousnessMonitor([entity]).scan()
    assert report["state"] == "DEGRADED"
    assert report["entities"][0]["brain_declared"] is False
    assert report["entities"][0]["missing"] == ["brain"]
