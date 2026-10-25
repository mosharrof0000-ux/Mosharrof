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


def test_autonomous_workflow_has_bounded_runtime_and_visual_qa_dependencies():
    workflow = Path(".github/workflows/mosharrof-autonomous-engine.yml").read_text(encoding="utf-8")
    assert "timeout-minutes: 30" in workflow
    assert "node --version" in workflow
    assert "npm install --no-save playwright" in workflow
    assert "npx playwright install --with-deps chromium" in workflow
    assert workflow.count("    inputs:") == 1



def test_only_the_central_engine_has_a_recurring_ai_writer_schedule():
    central = Path(".github/workflows/mosharrof-autonomous-engine.yml").read_text(encoding="utf-8")
    assert 'cron: "0 0-2,14-23 * * *"' in central
    assert "timeout-minutes: 30" in central
    assert "group: mosharrof-autonomous-engine" in central
    assert "queue: max" in central

    secondary = (
        ".github/workflows/autonomous-cycle.yml",
        ".github/workflows/mosharrof-autonomous.yml",
        ".github/workflows/mosharrof-autonomous-6h.yml",
        ".github/workflows/parallel-engine-builder.yml",
    )
    for filename in secondary:
        workflow = Path(filename).read_text(encoding="utf-8")
        assert "  schedule:" not in workflow, filename
        assert "group: mosharrof-autonomous-engine" in workflow, filename
        assert "queue: max" in workflow, filename


def test_component_safety_gate_passes_without_autonomous_self_merge():
    import subprocess
    result = subprocess.run(
        ["python3", "scripts/automation/autonomous_engine_safety_gate.py"],
        capture_output=True, text=True, check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert '"status": "PASS"' in result.stdout
