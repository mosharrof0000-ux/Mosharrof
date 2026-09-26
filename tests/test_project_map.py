from src.core.project_map import ProjectMap
from src.core.model_adapter import ModelAdapter

def test_project_map_is_valid():
    result = ProjectMap(".").validate()
    assert result["valid"] is True
    assert result["entity_count"] >= 4

def test_model_adapter_is_model_agnostic():
    result = ModelAdapter("test-model").run("hello")
    assert result["status"] == "READY"
    assert result["model"] == "test-model"
