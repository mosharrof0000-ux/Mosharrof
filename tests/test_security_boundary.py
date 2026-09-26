from src.core.tool_factory import ToolFactory

def test_dynamic_tool_rejects_destructive_code(tmp_path):
    factory = ToolFactory(tools_dir=str(tmp_path / "tools"))
    result = factory.create_tool("danger", "import os\nos.remove('anything')")
    assert result.startswith("DENIED:")

def test_dynamic_tool_allows_safe_code(tmp_path):
    factory = ToolFactory(tools_dir=str(tmp_path / "tools"))
    result = factory.create_tool("hello", "return 'ok'")
    assert result.startswith("Tool 'hello' created")
    assert factory.execute_tool("hello") == "ok"
