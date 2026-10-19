from pathlib import Path


def test_autonomous_workflows_do_not_cancel_in_progress_runs():
    paths = [
        Path(".github/workflows/autonomous-cycle.yml"),
        Path(".github/workflows/mosharrof-autonomous-6h.yml"),
    ]
    for path in paths:
        content = path.read_text(encoding="utf-8")
        assert "group: mosharrof-autonomous" in content
        assert "cancel-in-progress: false" in content
        assert "cancel-in-progress: true" not in content


def test_resume_protocol_distinguishes_real_execution_states():
    content = Path("docs/WORK_RESUME_PROTOCOL.md").read_text(encoding="utf-8")
    for state in ("RUNNING", "QUEUED", "PAUSED/BLOCKED", "FAILED", "SUCCESS", "NOT RUNNING"):
        assert state in content
    assert "last durable checkpoint" in content
    assert "not from the beginning" in content
    assert "/mosharrof status" in content
    assert "/mosharrof resume" in content


def test_issue_command_workflow_reports_status_and_avoids_duplicate_runs():
    workflow = Path(".github/workflows/work-resume-command.yml").read_text(encoding="utf-8")
    assert "issue_comment:" in workflow
    assert "listWorkflowRunsForRepo" in workflow
    assert "listJobsForWorkflowRun" in workflow
    assert "createWorkflowDispatch" in workflow
    assert "cancel-in-progress: false" in workflow
    assert "RUNNING" in workflow
    assert "NOT RUNNING" in workflow

    cycle = Path(".github/workflows/autonomous-cycle.yml").read_text(encoding="utf-8")
    assert "startsWith(github.event.comment.body, '/mosharrof run')" in cycle
    assert "contains(github.event.comment.body, '/mosharrof')" not in cycle
