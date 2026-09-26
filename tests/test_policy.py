from src.policies.core_policy import authorize

def test_delete_is_always_denied():
    assert authorize("DELETE")["status"] == "DENIED"
    assert authorize("anything", destructive=True)["status"] == "DENIED"

def test_normal_operation_can_be_allowed():
    assert authorize("READ")["status"] == "ALLOWED"
