"""Central capability policy. DELETE and destructive operations are never permitted."""
class PolicyDenied(PermissionError): pass
class CapabilityPolicy:
    def __init__(self, allow_write=True, allow_create=True, allow_execute=True): self.allow_write=allow_write; self.allow_create=allow_create; self.allow_execute=allow_execute
    def check(self, operation: str):
        op=operation.upper()
        if op=="DELETE" or op.startswith("DELETE_"): raise PolicyDenied("DELETE operations are permanently blocked.")
        if op.startswith("DESTRUCTIVE"): raise PolicyDenied("Destructive operations are permanently blocked.")
        allowed={"READ":True,"WRITE":self.allow_write,"CREATE":self.allow_create,"EXECUTE":self.allow_execute}
        if not allowed.get(op,False): raise PolicyDenied(f"Operation not permitted: {op}")
        return True
