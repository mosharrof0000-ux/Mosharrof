"""Safety contracts for autonomous promotion boundaries."""
from pathlib import Path


def test_autonomous_engine_never_merges_its_own_pull_request():
    source = Path("scripts/mosharrof_autonomous_engine.py").read_text(encoding="utf-8")
    assert '"gh", "pr", "merge"' not in source
    assert '"--auto"' not in source
    assert "PR created for review; automatic merge intentionally disabled" in source
