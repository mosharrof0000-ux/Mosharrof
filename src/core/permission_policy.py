"""Central permission guard for Mosharrof."""
from typing import Iterable

DENIED_OPERATIONS={"DELETE","DESTRUCTIVE"}

class PermissionPolicy:
    def __init__(self, allowed_operations: Iterable[str]=()):
        self.allowed_operations={str(item).upper() for item in allowed_operations}

    def check(self, operation: str)->dict:
        op=str(operation).upper()
        if op in DENIED_OPERATIONS:
            return {"status":"DENIED","reason":"DELETE_AND_DESTRUCTIVE_OPERATIONS_BLOCKED"}
        if op not in self.allowed_operations:
            return {"status":"DENIED","reason":"OPERATION_NOT_GRANTED","operation":op}
        return {"status":"ALLOWED","operation":op}

    @staticmethod
    def validate_tool_source(code: str)->dict:
        source=code.lower()
        blocked=("os.remove(","os.unlink(","shutil.rmtree(","path.unlink(","subprocess.run(","subprocess.popen(","rm -rf")
        hits=[item for item in blocked if item in source]
        if hits:
            return {"status":"DENIED","reason":"DESTRUCTIVE_CODE_DETECTED","matches":hits}
        return {"status":"ALLOWED"}
