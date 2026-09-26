"""Policy-aware dynamic tool factory."""
import os
import importlib.util
from typing import Dict, Any, Callable
from src.core.permission_policy import PermissionPolicy

class ToolFactory:
    def __init__(self, tools_dir: str="src/tools", permission_policy=None):
        self.tools_dir=tools_dir
        self.registry: Dict[str,Callable]={}
        self.permission_policy=permission_policy or PermissionPolicy({"CREATE","UPDATE","EXECUTE","READ"})
        os.makedirs(self.tools_dir,exist_ok=True)
        self._load_existing_tools()

    def _load_existing_tools(self):
        for filename in os.listdir(self.tools_dir):
            if filename.endswith(".py") and not filename.startswith("__"):
                self._import_and_register(filename[:-3])

    def _import_and_register(self, tool_name: str)->bool:
        file_path=os.path.join(self.tools_dir,f"{tool_name}.py")
        if not os.path.isfile(file_path): return False
        try:
            spec=importlib.util.spec_from_file_location(tool_name,file_path)
            if spec and spec.loader:
                module=importlib.util.module_from_spec(spec)
                spec.loader.exec_module(module)
                if hasattr(module,"run"):
                    self.registry[tool_name]=module.run
                    return True
        except Exception:
            return False
        return False

    def create_tool(self, tool_name: str, code_body: str)->str:
        if self.permission_policy.check("CREATE")["status"]!="ALLOWED":
            return "DENIED: CREATE permission is not granted."
        if self.permission_policy.validate_tool_source(code_body)["status"]!="ALLOWED":
            return "DENIED: destructive code detected."
        clean_name=tool_name.lower().strip().replace(" ","_")
        if not clean_name or "/" in clean_name or "\\" in clean_name or ".." in clean_name:
            return "DENIED: invalid tool name."
        file_path=os.path.join(self.tools_dir,f"{clean_name}.py")
        full_code=f'"""Mosharrof dynamic tool: {clean_name}."""\n\ndef run(*args, **kwargs):\n    {code_body}\n'
        with open(file_path,"w",encoding="utf-8") as handle: handle.write(full_code)
        if self._import_and_register(clean_name): return f"Tool '{clean_name}' created and activated."
        return f"Tool '{clean_name}' was saved but could not be activated."

    def execute_tool(self, tool_name: str, *args, **kwargs)->Any:
        if self.permission_policy.check("EXECUTE")["status"]!="ALLOWED":
            return "DENIED: EXECUTE permission is not granted."
        clean_name=tool_name.lower().strip().replace(" ","_")
        if clean_name in self.registry: return self.registry[clean_name](*args,**kwargs)
        return f"ERROR: tool '{clean_name}' is not registered."

    def list_available_tools(self)->list:
        return sorted(self.registry.keys())
