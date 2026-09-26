"""
Permission-bounded dynamic tool factory.
DELETE/destructive operations are never permitted by policy.
"""
import importlib.util
import os
from typing import Any, Callable, Dict

class ToolFactory:
    def __init__(self, tools_dir: str = "src/tools", allow_creation: bool = True):
        self.tools_dir = tools_dir
        self.allow_creation = allow_creation
        self.registry: Dict[str, Callable] = {}
        os.makedirs(self.tools_dir, exist_ok=True)
        self._load_existing_tools()

    def _load_existing_tools(self):
        for filename in sorted(os.listdir(self.tools_dir)):
            if filename.endswith(".py") and not filename.startswith("__"):
                self._import_and_register(filename[:-3])

    def _import_and_register(self, tool_name: str) -> bool:
        file_path = os.path.join(self.tools_dir, f"{tool_name}.py")
        if not os.path.isfile(file_path):
            return False
        try:
            spec = importlib.util.spec_from_file_location(tool_name, file_path)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                if callable(getattr(module, "run", None)):
                    self.registry[tool_name] = module.run
                    return True
        except Exception:
            return False
        return False

    def create_tool(self, tool_name: str, code_body: str) -> str:
        if not self.allow_creation:
            return "DENIED: TOOL_CREATION_NOT_PERMITTED"
        if not tool_name.strip() or "delete" in tool_name.lower():
            return "DENIED: INVALID_OR_DESTRUCTIVE_TOOL_NAME"
        clean_name = tool_name.lower().strip().replace(" ", "_")
        file_path = os.path.join(self.tools_dir, f"{clean_name}.py")
        full_code = (f'"""Mosharrof dynamic tool: {clean_name}."""\n\n'
                     "def run(*args, **kwargs):\n"
                     f"    {code_body}\n")
        with open(file_path, "w", encoding="utf-8") as handle:
            handle.write(full_code)
        if self._import_and_register(clean_name):
            return f"Tool '{clean_name}' created and registered."
        return f"Tool '{clean_name}' was written but failed validation/load."

    def execute_tool(self, tool_name: str, *args, **kwargs) -> Any:
        clean_name = tool_name.lower().strip().replace(" ", "_")
        if clean_name not in self.registry:
            return f"ERROR: tool '{clean_name}' is not registered."
        return self.registry[clean_name](*args, **kwargs)

    def list_available_tools(self) -> list:
        return sorted(self.registry)
