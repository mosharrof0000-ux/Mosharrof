"""Dynamic tool registry with an enforced destructive-operation boundary."""

import ast
import importlib.util
import os
import textwrap
from typing import Any, Callable, Dict

from src.core.permission_engine import PermissionEngine


class ToolFactory:
    BLOCKED_CALLS = {
        "remove", "unlink", "rmtree", "rmdir", "rename", "replace",
        "system", "popen", "run", "call", "check_call", "check_output",
        "open", "eval", "exec", "compile", "__import__", "input",
    }
    BLOCKED_MODULES = {
        "os", "shutil", "subprocess", "pathlib", "sys", "socket",
        "requests", "httpx", "urllib", "ctypes",
    }

    def __init__(self, tools_dir: str = "src/tools"):
        self.tools_dir = tools_dir
        self.registry: Dict[str, Callable] = {}
        self.permission_engine = PermissionEngine()
        os.makedirs(self.tools_dir, exist_ok=True)
        self._load_existing_tools()

    def _load_existing_tools(self):
        for filename in os.listdir(self.tools_dir):
            if filename.endswith(".py") and not filename.startswith("__"):
                tool_name = filename[:-3]
                path = os.path.join(self.tools_dir, filename)
                try:
                    with open(path, "r", encoding="utf-8") as handle:
                        source = handle.read()
                    if self._contains_blocked_operation(source):
                        continue
                except OSError:
                    continue
                self._import_and_register(tool_name)

    @classmethod
    def _contains_blocked_operation(cls, code_body: str) -> bool:
        """Reject destructive, shell, import, and reflection escape paths."""
        try:
            wrapped = "def _probe():\n" + textwrap.indent(code_body, "    ")
            tree = ast.parse(wrapped)
        except SyntaxError:
            return True

        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                return True
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Attribute) and (
                    node.func.attr in cls.BLOCKED_CALLS or node.func.attr.startswith("__")
                ):
                    return True
                if isinstance(node.func, ast.Name) and (
                    node.func.id.upper() in {"DELETE", "DESTROY", "ERASE", "PURGE"}
                    or node.func.id in cls.BLOCKED_CALLS
                ):
                    return True
            if isinstance(node, ast.Attribute) and node.attr.startswith("__"):
                return True
            if isinstance(node, ast.Name) and node.id in cls.BLOCKED_MODULES:
                return True
        return False

    def _import_and_register(self, tool_name: str) -> bool:
        file_path = os.path.join(self.tools_dir, f"{tool_name}.py")
        if not os.path.exists(file_path):
            return False
        try:
            spec = importlib.util.spec_from_file_location(tool_name, file_path)
            if spec and spec.loader:
                module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                if hasattr(module, "run") and callable(module.run):
                    self.registry[tool_name] = module.run
                    return True
        except Exception as exc:
            print(f"Error loading tool '{tool_name}': {exc}")
        return False

    def create_tool(self, tool_name: str, code_body: str) -> str:
        decision = self.permission_engine.authorize("CREATE_TOOL", scope="tools")
        if decision["status"] != "ALLOWED":
            return f"DENIED: {decision['reason']}"
        if self._contains_blocked_operation(code_body):
            return "DENIED: IMPORT_DELETE_DESTRUCTIVE_OR_UNSAFE_OPERATION_BLOCKED"

        clean_name = tool_name.lower().strip().replace(" ", "_")
        if not clean_name or not clean_name.replace("_", "").isalnum():
            return "DENIED: INVALID_TOOL_NAME"

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
        return f"Tool '{clean_name}' was written but could not be loaded."

    def execute_tool(self, tool_name: str, *args, **kwargs) -> Any:
        decision = self.permission_engine.authorize("EXECUTE_TOOL", scope=f"tools/{tool_name}")
        if decision["status"] != "ALLOWED":
            return decision
        clean_name = tool_name.lower().strip().replace(" ", "_")
        if clean_name in self.registry:
            return self.registry[clean_name](*args, **kwargs)
        return f"ERROR: tool '{clean_name}' is not registered."

    def list_available_tools(self) -> list:
        return sorted(self.registry.keys())
