from src.core.capability_policy import authorize


def test_delete_is_always_blocked():
    assert authorize("DELETE", ["DELETE", "WRITE"]) is False


def test_destroy_is_always_blocked():
    assert authorize("DESTROY", ["DESTROY"]) is False


def test_allowed_non_destructive_operation():
    assert authorize("READ", ["READ", "WRITE"]) is True


def test_undeclared_operation_is_denied():
    assert authorize("EXECUTE", ["READ"]) is False
