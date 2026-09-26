"""
Mosharrof Tool Factory.

Dynamic tools are capability-scoped. DELETE/destructive operations are blocked
before code is written or executed.
"""
import os
import importlib.util
from typing import Dict, Any, Callable
from src.policies.core_policy import authorize

class ToolFactory:
    def __init__(self, tools_dir: str = "src/tools"):
        self.tools_dir = tools_dir
        self.registry: Dict[str, Callable] = {}
        os.makedirs(self.tools_dir, exist_ok=True)
        self._load_existing_tools()

    def _load_existing_tools(self):
        for filename in os.listdir(self.tools_dir):
            if filename.endswith(".py") and not filename.startswith("__"):
                self._import_and_register(filename[:-3])

    def _import_and_register(self, tool_name: str) -> bool:
        file_path = os.path.join(self.tools_dir, f"{tool_name}.py")
        if not os.path.exists(file_path):
            return False
        try:
            spec = importlib.util.spec_from_file_location(tool_name, file_path)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                if hasattr(module, "run"):
                    self.registry[tool_name] = module.run
                    return True
        except Exception:
            return False
        return False

    @staticmethod
    def _contains_forbidden_code(code_body: str) -> bool:
        text = (code_body or "").upper()
        blocked = (
            "OS.REMOVE", "OS.UNLINK", "SHUTIL.RMTREE", "PATHLIB.PATH.UNLINK",
            "PATHLIB.PATH.RMDIR", "SUBPROCESS", "DELETE", "DESTROY", "PURGE", "ERASE"
        )
        return any(token in text for token in blocked)

    def create_tool(self, tool_name: str, code_body: str) -> str:
        if self._contains_forbidden_code(code_body):
            return "DENIED: DELETE/destructive operations are blocked by Core policy."
        clean_name = tool_name.lower().strip().replace(" ", "_")
        if not clean_name or not clean_name.replace("_", "").isalnum():
            return "DENIED: invalid tool name."
        policy = authorize("CREATE_TOOL")
        if policy["status"] != "ALLOWED":
            return policy["reason"]
        file_path = os.path.join(self.tools_dir, f"{clean_name}.py")
        full_code = f'''"""Mosharrof AI Dynamic Tool: {clean_name}"""

def run(*args, **kwargs):
    {code_body}
'''
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(full_code)
        if self._import_and_register(clean_name):
            return f"Tool '{clean_name}' created and registered."
        return f"Tool '{clean_name}' saved but registration failed."

    def execute_tool(self, tool_name: str, *args, **kwargs) -> Any:
        clean_name = tool_name.lower().strip().replace(" ", "_")
        if clean_name in self.registry:
            return self.registry[clean_name](*args, **kwargs)
        return f"ERROR: tool '{clean_name}' is not registered."

    def list_available_tools(self) -> list:
        return list(self.registry.keys())
