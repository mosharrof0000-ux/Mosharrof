"""Quality checks for generated autonomous file patches."""


def is_trivial_rewrite(current: str, proposed: str) -> bool:
    """Return True when the only difference is the number/presence of final newlines."""
    return current.rstrip("\\n") == proposed.rstrip("\\n")
