from src.core.tool_factory import ToolFactory


def test_tool_factory_rejects_destructive_code(tmp_path):
    factory = ToolFactory(tools_dir=str(tmp_path / "tools"))
    result = factory.create_tool("bad_tool", "import os\nos.remove('important.txt')\nreturn True")
    assert result == "DENIED: DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED"
    assert factory.list_available_tools() == []


def test_tool_factory_creates_safe_tool(tmp_path):
    factory = ToolFactory(tools_dir=str(tmp_path / "tools"))
    result = factory.create_tool("hello", "return 'ok'")
    assert "created and registered" in result
    assert factory.execute_tool("hello") == "ok"
