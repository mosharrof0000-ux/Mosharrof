from src.core.capability_policy import authorize
from src.core.tool_factory import ToolFactory


def test_factory_cannot_authorize_delete():
    factory = ToolFactory()
    assert authorize("DELETE", ["DELETE", "WRITE"]) is False
    assert factory.create_tool("blocked", "return 1", ["DELETE"]) != "Tool 'blocked' created and registered."
