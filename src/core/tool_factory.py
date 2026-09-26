"""Non-destructive dynamic tool registry.

Tool creation/execution is kept behind explicit operation policy. DELETE and
destructive operations are never permitted by this factory.
"""

import importlib.util
import os
from typing import Any, Callable, Dict

from src.core.capability_policy import authorize


class ToolFactory:
    def __init__(self, tools_dir: str = "src/tools"):
        self.tools_dir = tools_dir
        self.registry: Dict[str, Callable] = {}
        os.makedirs(self.tools_dir, exist_ok=True)
        self._load_existing_tools()

    def _load_existing_tools(self) -> None:
        for filename in os.listdir(self.tools_dir):
            if filename.endswith(".py") and not filename.startswith("__"):
                self._import_and_register(filename[:-3])

    def _import_and_register(self, tool_name: str) -> bool:
        file_path = os.path.join(self.tools_dir, f"{tool_name}.py")
        if not os.path.isfile(file_path):
            return False
        try:
            spec = importlib.util.spec_from_file_location(tool_name, file_path)
            if not spec or not spec.loader:
                return False
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            if hasattr(module, "run") and callable(module.run):
                self.registry[tool_name] = module.run
                return True
        except Exception as exc:
            print(f"Error loading tool '{tool_name}': {exc}")
        return False

    def create_tool(
        self,
        tool_name: str,
        code_body: str,
        allowed_operations=None,
    ) -> str:
        allowed = allowed_operations or ["READ", "WRITE"]
        if not authorize("WRITE", allowed):
            return "DENIED: tool creation is outside the declared permission scope."

        clean_name = tool_name.lower().strip().replace(" ", "_")
        if not clean_name or not clean_name.replace("_", "").isalnum():
            return "DENIED: invalid tool name."

        file_path = os.path.join(self.tools_dir, f"{clean_name}.py")
        full_code = (
            f'"""Mosharrof dynamic tool: {clean_name}."""\n\n'
            "def run(*args, **kwargs):\n"
            f"    {code_body}\n"
        )
        with open(file_path, "w", encoding="utf-8") as handle:
            handle.write(full_code)

        if self._import_and_register(clean_name):
            return f"Tool '{clean_name}' created and registered."
        return f"Tool '{clean_name}' was saved but could not be loaded."

    def execute_tool(self, tool_name: str, *args, **kwargs) -> Any:
        clean_name = tool_name.lower().strip().replace(" ", "_")
        if clean_name not in self.registry:
            return f"ERROR: tool '{clean_name}' is not registered."
        return self.registry[clean_name](*args, **kwargs)

    def list_available_tools(self) -> list:
        return sorted(self.registry.keys())
