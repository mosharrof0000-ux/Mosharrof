"""Tests for the model-agnostic entity foundation and registry."""
from src.core.brain_adapter import BrainAdapter
from src.core.entity_registry import EntityRegistry


class DummyProvider:
    def generate(self, prompt: str, **kwargs):
        return f"ok:{prompt}"


def test_entity_registry_is_valid():
    registry = EntityRegistry()
    assert {"core", "chat", "sidebar", "quran_research"} <= set(registry.list_ids())
    assert all(not registry.get(entity_id).get("delete_allowed", False)
               for entity_id in registry.list_ids())


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
