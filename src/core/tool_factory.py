"""Controlled dynamic tool factory.

Tool creation remains scoped to src/tools. Obvious destructive operations are
rejected before code is written. This is a policy gate, not a sandbox.
"""

import importlib.util
import os
from typing import Any, Callable, Dict

from src.core.permission_guard import PermissionGuard


class ToolFactory:
    BLOCKED_PATTERNS = (
        "os.remove", "os.unlink", "shutil.rmtree", "Path.unlink",
        "DROP TABLE", "DROP DATABASE", "DELETE FROM", "TRUNCATE TABLE",
    )

    def __init__(self, tools_dir: str = "src/tools"):
        self.tools_dir = tools_dir
        self.registry: Dict[str, Callable] = {}
        self.permission_guard = PermissionGuard()
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
                if callable(getattr(module, "run", None)):
                    self.registry[tool_name] = module.run
                    return True
        except Exception:
            return False
        return False

    def create_tool(self, tool_name: str, code_body: str) -> str:
        clean_name = tool_name.lower().strip().replace(" ", "_")
        if not clean_name or "/" in clean_name or "\\" in clean_name:
            return "DENIED: invalid tool name"
        if any(pattern.lower() in code_body.lower() for pattern in self.BLOCKED_PATTERNS):
            return "DENIED: destructive operation blocked by Mosharrof policy"

        file_path = os.path.join(self.tools_dir, f"{clean_name}.py")
        full_code = f'''"""Mosharrof dynamic tool: {clean_name}."""

def run(*args, **kwargs):
    {code_body}
'''
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
        return list(self.registry.keys())
