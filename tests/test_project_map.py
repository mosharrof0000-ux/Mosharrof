from src.core.project_map import ProjectMap

def test_project_map_is_valid():
    result = ProjectMap(".").validate()
    assert result["valid"] is True
    assert result["entity_count"] >= 7
