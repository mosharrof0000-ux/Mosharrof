"""Unit tests for the full-app QA runner's safety defaults."""
import ast
from pathlib import Path

SOURCE = Path("scripts/full_app_interactive_qa.py")


def test_qa_runner_defaults_to_read_only():
    tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
    source = SOURCE.read_text(encoding="utf-8")
    assert 'os.environ.get("MOSHARROF_QA_SEND_MESSAGE", "0")' in source
    assert '"PAGE_URL"' in source and 'https://mosharrof0000-ux.github.io/Mosharrof/' in source
    assert "if SEND_MESSAGE:" in source


def test_qa_runner_records_artifact_and_checks_failures():
    source = SOURCE.read_text(encoding="utf-8")
    assert '"report.json"' in source
    assert '"initial-mobile.png"' in source
    assert '"failed_requests"' in source
    assert 'return 1 if report["summary"]["failed"] else 0' in source


def test_response_count_is_part_of_completion_condition():
    source = SOURCE.read_text(encoding="utf-8")
    assert "before_ai_count" in source
    assert "replies > baseline.aiCount" in source
    assert "&& !pending" in source
