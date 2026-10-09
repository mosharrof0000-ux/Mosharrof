"""Dynamic tool registry with trusted capability authorization.

Dynamic tools execute inside the Mosharrof process and are not a security
sandbox. Registration and execution therefore require explicit trusted
capability authorization; an unconfigured service denies both operations.
"""
import ast
import importlib.util
import os
import textwrap
from typing import Any, Callable, Dict

from src.core.trusted_permission_service import TrustedPermissionService


class ToolFactory:
    BLOCKED_NAMES = {
        "eval", "exec", "compile", "open", "__import__", "input",
        "globals", "locals", "vars", "breakpoint",
        "getattr", "setattr", "delattr",
    }
    BLOCKED_MODULES = {
        "os", "sys", "subprocess", "shutil", "socket", "pathlib",
        "requests", "httpx", "urllib", "ctypes", "pickle",
        "importlib", "runpy", "builtins", "tempfile", "multiprocessing",
    }
    BLOCKED_ATTRIBUTES = {
        "remove", "unlink", "rmtree", "rmdir", "rename", "replace",
        "system", "popen", "run", "call", "check_call", "check_output",
        "chmod", "chown",
    }
    BLOCKED_IDENTIFIER_NAMES = {
        "__builtins__", "__loader__", "__spec__", "__package__", "__cached__",
    }

    def __init__(
        self,
        tools_dir: str = "src/tools",
        *,
        trusted_permission_service: TrustedPermissionService | None = None,
    ):
        self.tools_dir = tools_dir
        self.registry: Dict[str, Callable] = {}
        # The default service has no trusted resolvers and therefore denies.
        self.trusted_permission_service = (
            trusted_permission_service or TrustedPermissionService()
        )
        os.makedirs(self.tools_dir, exist_ok=True)
        # Do not import existing modules at startup: importing can execute
        # module-level code before an execution capability has been checked.

    @classmethod
    def _contains_blocked_operation(cls, code_body: str) -> bool:
        try:
            wrapped = "def _probe():\n" + textwrap.indent(code_body, "    ")
            tree = ast.parse(wrapped)
        except SyntaxError:
            return True

        for node in ast.walk(tree):
            if isinstance(node, (ast.Import, ast.ImportFrom)):
                if any(alias.name.split(".")[0].lower() in cls.BLOCKED_MODULES for alias in node.names):
                    return True
            if isinstance(node, ast.Name) and node.id in cls.BLOCKED_IDENTIFIER_NAMES:
                return True
            if isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name) and node.func.id in cls.BLOCKED_NAMES:
                    return True
                if isinstance(node.func, ast.Attribute) and node.func.attr.lower() in cls.BLOCKED_ATTRIBUTES:
                    return True
                if isinstance(node.func, ast.Name) and node.func.id.upper() in {
                    "DELETE", "DESTROY", "ERASE", "PURGE", "DROP_DATABASE"
                }:
                    return True
            if isinstance(node, ast.Attribute) and node.attr.startswith("__"):
                return True
        return False

    def _authorize(self, capability: str, tool_name: str, approval_token: Any) -> dict[str, Any]:
        return self.trusted_permission_service.authorize(
            capability,
            entity_id="tool_factory",
            resource_scope=f"tools/{tool_name}",
            approval_token=approval_token,
        )

    def _import_and_register(self, tool_name: str) -> bool:
        file_path = os.path.join(self.tools_dir, f"{tool_name}.py")
        if not os.path.exists(file_path):
            return False
        try:
            with open(file_path, "r", encoding="utf-8") as handle:
                source = handle.read()
            if self._contains_blocked_operation(source):
                return False
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

    def create_tool(
        self, tool_name: str, code_body: str, *, approval_token: Any = None
    ) -> str:
        clean_name = tool_name.lower().strip().replace(" ", "_")
        if not clean_name or not clean_name.replace("_", "").isalnum():
            return "DENIED: INVALID_TOOL_NAME"
        if self._contains_blocked_operation(code_body):
            return "DENIED: DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED"

        decision = self._authorize("ai.tool.register", clean_name, approval_token)
        if decision.get("status") != "ALLOWED":
            return f"DENIED: {decision.get('reason', 'TRUSTED_AUTHORIZATION_DENIED')}"

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

    def execute_tool(
        self, tool_name: str, *args, approval_token: Any = None, **kwargs
    ) -> Any:
        clean_name = tool_name.lower().strip().replace(" ", "_")
        if not clean_name or not clean_name.replace("_", "").isalnum():
            return {"status": "DENIED", "reason": "INVALID_TOOL_NAME"}

        decision = self._authorize("ai.tool.execute", clean_name, approval_token)
        if decision.get("status") != "ALLOWED":
            return decision

        # Load only after the trusted execution check has passed.
        if clean_name not in self.registry and not self._import_and_register(clean_name):
            return {"status": "ERROR", "reason": "TOOL_NOT_REGISTERED", "tool": clean_name}
        return self.registry[clean_name](*args, **kwargs)

    def list_available_tools(self) -> list:
        return sorted(self.registry.keys())
