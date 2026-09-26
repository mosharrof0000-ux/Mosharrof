"""
Mosharrof Dynamic Tool Factory

Creates and loads small Python tools while enforcing the permanent
no-delete/destructive-operation policy at the tool boundary.

This is a policy guard, not a security sandbox. Production execution should
still use an isolated runtime for untrusted code.
"""

import importlib.util
import os
import re
from typing import Dict, Any, Callable

from src.core.permission_guard import PermissionGuard


class ToolFactory:
    _BLOCKED_PATTERNS = (
        r"\bos\.remove\b",
        r"\bos\.unlink\b",
        r"\bshutil\.rmtree\b",
        r"\bPath\([^)]*\)\.unlink\b",
        r"\bsubprocess\.(run|Popen|call|check_call|check_output)\b.*\brm\b",
        r"\bDELETE\b",
    )

    def __init__(self, tools_dir: str = "src/tools", permission_guard=None):
        self.tools_dir = tools_dir
        self.registry: Dict[str, Callable] = {}
        self.permission_guard = permission_guard or PermissionGuard()
        os.makedirs(self.tools_dir, exist_ok=True)
        self._load_existing_tools()

    def _load_existing_tools(self):
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

    def _contains_blocked_operation(self, code_body: str) -> bool:
        return any(re.search(pattern, code_body, re.IGNORECASE | re.DOTALL)
                   for pattern in self._BLOCKED_PATTERNS)

    def create_tool(self, tool_name: str, code_body: str) -> str:
        self.permission_guard.require("CREATE_TOOL")
        clean_name = tool_name.lower().strip().replace(" ", "_")
        if not clean_name or not clean_name.replace("_", "").isalnum():
            return "ERROR: invalid tool name."
        if self._contains_blocked_operation(code_body):
            return "DENIED: DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED"

        file_path = os.path.join(self.tools_dir, f"{clean_name}.py")
        full_code = f'''"""
Mosharrof dynamic tool: {clean_name}
"""

def run(*args, **kwargs):
    {code_body}
'''
        with open(file_path, "w", encoding="utf-8") as handle:
            handle.write(full_code)

        if self._import_and_register(clean_name):
            return f"Tool '{clean_name}' created and registered."
        return f"ERROR: tool '{clean_name}' was saved but could not be loaded."

    def execute_tool(self, tool_name: str, *args, **kwargs) -> Any:
        self.permission_guard.require("EXECUTE_TOOL")
        clean_name = tool_name.lower().strip().replace(" ", "_")
        if clean_name not in self.registry:
            return f"ERROR: tool '{clean_name}' is not registered."
        return self.registry[clean_name](*args, **kwargs)

    def list_available_tools(self) -> list:
        return sorted(self.registry.keys())
