"""Tests for the model-agnostic entity foundation."""
import json
from pathlib import Path
from src.core.brain_adapter import BrainAdapter


class DummyProvider:
    def generate(self, prompt: str, **kwargs):
        return f"ok:{prompt}"


def test_manifest_and_registry_are_valid():
    manifest = json.loads(Path("config/project_manifest.json").read_text(encoding="utf-8"))
    registry = json.loads(Path("config/entity_registry.json").read_text(encoding="utf-8"))
    assert manifest["name"] == "Mosharrof"
    ids = {entity["id"] for entity in registry["entities"]}
    assert {"core", "chat", "sidebar", "quran_research"} <= ids
    assert all(not entity.get("delete_allowed", False) for entity in registry["entities"])


def test_brain_adapter_preserves_entity_identity():
    adapter = BrainAdapter("chat")
    assert adapter.describe()["model_independent_identity"] is True
    adapter.attach(DummyProvider())
    assert adapter.generate("hello") == "ok:hello"


def test_brain_adapter_requires_provider():
    try:
        BrainAdapter("core").generate("hello")
    except RuntimeError as exc:
        assert str(exc) == "NO_BRAIN_PROVIDER_ATTACHED"
    else:
        raise AssertionError("A brain without a provider must not execute")
