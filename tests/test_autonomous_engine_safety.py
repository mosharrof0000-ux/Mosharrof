"""Safety contracts for autonomous promotion boundaries."""
from pathlib import Path


AUTONOMOUS_ENTRYPOINTS = (
    "scripts/mosharrof_autonomous_engine.py",
    "scripts/autonomous_agent.py",
)


def test_autonomous_agents_never_merge_their_own_pull_requests():
    for filename in AUTONOMOUS_ENTRYPOINTS:
        source = Path(filename).read_text(encoding="utf-8")
        assert '"gh", "pr", "merge"' not in source, filename
        assert '"--auto"' not in source, filename
        assert "PR opened for review; automatic merge intentionally disabled" in source or (
            "PR created for review; automatic merge intentionally disabled" in source
        ), filename
