from src.core.storage_engine import StorageEngine
from src.core.tool_factory import ToolFactory

def test_storage_organization_uses_move_permission(tmp_path):
    source = tmp_path / "note.txt"
    source.write_text("safe", encoding="utf-8")
    result = StorageEngine().auto_organize_folder(str(tmp_path))
    assert result["status"] == "SUCCESS"
    assert result["operation"] == "MOVE_FILES"
    assert (tmp_path / "Documents" / "note.txt").exists()

def test_tool_factory_rejects_destructive_code(tmp_path):
    factory = ToolFactory(tools_dir=str(tmp_path / "tools"))
    result = factory.create_tool("unsafe", "import os; os.remove('x')")
    assert result.startswith("DENIED:")
    assert "DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED" in result
