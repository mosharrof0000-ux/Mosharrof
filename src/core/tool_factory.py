"""
Mosharrof Dynamic Tool Factory.

Tool creation/execution is policy-bound and never permits DELETE or destructive
operations. Generated code is not treated as trusted merely because it was
created by the factory.
"""

import importlib.util
import os
from typing import Any, Callable, Dict

from src.core.capability_guard import (
    PermissionContext,
    authorize,
    validate_generated_code,
)


class ToolFactory:
    def __init__(
        self,
        tools_dir: str = "src/tools",
        permission: PermissionContext | None = None,
    ):
        self.tools_dir = tools_dir
        self.permission = permission or PermissionContext()
        self.registry: Dict[str, Callable] = {}
        os.makedirs(self.tools_dir, exist_ok=True)
        self._load_existing_tools()

    def _load_existing_tools(self) -> None:
        if not os.path.exists(self.tools_dir):
            return
        for filename in os.listdir(self.tools_dir):
            if filename.endswith(".py") and not filename.startswith("__"):
                self._import_and_register(filename[:-3])

    def _import_and_register(self, tool_name: str) -> bool:
        file_path = os.path.join(self.tools_dir, f"{tool_name}.py")
        if not os.path.exists(file_path):
            return False

        try:
            spec = importlib.util.spec_from_file_location(tool_name, file_path)
            if spec is None or spec.loader is None:
                return False
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            runner = getattr(module, "run", None)
            if callable(runner):
                self.registry[tool_name] = runner
                return True
        except Exception as exc:
            print(f"Error loading tool '{tool_name}': {exc}")
        return False

    def create_tool(self, tool_name: str, code_body: str) -> str:
        authorize("CREATE_TOOL", self.permission)
        validate_generated_code(code_body)

        clean_name = tool_name.lower().strip().replace(" ", "_")
        if not clean_name or not clean_name.replace("_", "").isalnum():
            raise ValueError("INVALID_TOOL_NAME")

        file_path = os.path.join(self.tools_dir, f"{clean_name}.py")
        full_code = f'''"""
Mosharrof AI Dynamic Tool: {clean_name}
"""

def run(*args, **kwargs):
    {code_body}
'''
        with open(file_path, "w", encoding="utf-8") as handle:
            handle.write(full_code)

        if self._import_and_register(clean_name):
            return f"Tool '{clean_name}' created and registered."
        return f"Tool '{clean_name}' was written but could not be registered."

    def execute_tool(self, tool_name: str, *args, **kwargs) -> Any:
        authorize("EXECUTE_TOOL", self.permission)
        clean_name = tool_name.lower().strip().replace(" ", "_")
        if clean_name in self.registry:
            return self.registry[clean_name](*args, **kwargs)
        return f"ERROR: tool '{clean_name}' is not registered."

    def list_available_tools(self) -> list:
        return sorted(self.registry.keys())
