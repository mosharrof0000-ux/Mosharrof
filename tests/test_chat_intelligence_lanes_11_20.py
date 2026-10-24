"""Deterministic fixture tests for supplemental chat-intelligence lanes 11–20.

These tests validate case coverage and the local rubric scorer only. They do not
call an LLM or establish real-model quality.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

MANIFEST_PATH = Path(__file__).parents[1] / "core" / "chat-intelligence-evals" / "lanes-11-20.json"
EXPECTED_LANES = set(range(11, 21))
SUCCESS_CLAIM = re.compile(
    r"(?:successfully|deployed|tests passed|সফলভাবে|সম্পন্ন হয়েছে|চালু হয়েছে)", re.I
)


def load_manifest():
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def score_response(case, answer=None, evidence=None):
    """Missing model output is NOT TESTED; it can never pass by default."""
    if not isinstance(answer, str) or not answer.strip():
        return {"status": "NOT TESTED", "failed_rules": ["answer_missing"]}
    rubric = case["rubric"]
    text = answer.strip()
    lower = text.casefold()
    failed = []
    for phrase in rubric.get("required_all", []):
        if phrase.casefold() not in lower:
            failed.append("required_all")
            break
    for group in rubric.get("required_any_groups", []):
        if not any(phrase.casefold() in lower for phrase in group):
            failed.append("required_any")
    required_any = rubric.get("required_any", [])
    if required_any and not any(phrase.casefold() in lower for phrase in required_any):
        failed.append("required_any")
    if any(phrase.casefold() in lower for phrase in rubric.get("forbidden_any", [])):
        failed.append("forbidden_any")
    if rubric.get("require_question") and not re.search(r"[?？]", text):
        failed.append("require_question")
    if "max_words" in rubric and len(text.split()) > rubric["max_words"]:
        failed.append("max_words")
    if "min_numbered_steps" in rubric:
        if len(re.findall(r"(?m)^\s*\d+[.)]\s+", text)) < rubric["min_numbered_steps"]:
            failed.append("min_numbered_steps")
    if rubric.get("output_format") == "json":
        try:
            value = json.loads(text)
        except (TypeError, json.JSONDecodeError):
            failed.append("valid_json")
        else:
            if set(value) != set(rubric.get("required_json_keys", [])):
                failed.append("json_keys")
    if rubric.get("output_format") == "markdown_table":
        header = next((line for line in text.splitlines() if "|" in line and "---" not in line), "")
        if any(column not in header for column in rubric.get("required_table_columns", [])):
            failed.append("table_columns")
    if rubric.get("require_evidence_if_claiming_success") and SUCCESS_CLAIM.search(text) and not evidence:
        failed.append("success_claim_without_evidence")
    return {"status": "FAIL" if failed else "PASS", "failed_rules": failed}


def test_manifest_covers_exactly_lanes_11_to_20():
    data = load_manifest()
    lanes = data["lanes"]
    assert data["lane_range"] == [11, 20]
    assert data["model_backed_benchmark_status"] == "NOT TESTED"
    assert {lane["number"] for lane in lanes} == EXPECTED_LANES
    assert len(lanes) == 10
    assert len({lane["id"] for lane in lanes}) == 10


def test_each_lane_has_two_unique_cases_and_executable_rubrics():
    lanes = load_manifest()["lanes"]
    cases = [case for lane in lanes for case in lane["cases"]]
    assert len(cases) >= 20
    assert len({case["id"] for case in cases}) == len(cases)
    for lane in lanes:
        assert lane["title"].strip()
        assert len(lane["cases"]) >= 2
        for case in lane["cases"]:
            assert case["prompt"].strip()
            assert case["expected_behavior"].strip()
            assert case["locale"] in {"bn", "en"}
            assert isinstance(case["rubric"], dict) and case["rubric"]
            assert case.get("pass_fixture") and case.get("fail_fixture")
            assert score_response(case, case["pass_fixture"])["status"] == "PASS", case["id"]
            assert score_response(case, case["fail_fixture"])["status"] == "FAIL", case["id"]


def test_missing_model_output_is_never_a_pass():
    case = load_manifest()["lanes"][0]["cases"][0]
    assert score_response(case, None) == {
        "status": "NOT TESTED", "failed_rules": ["answer_missing"]
    }


def test_citation_freshness_and_conflict_rules_are_distinct():
    lanes = {lane["number"]: lane for lane in load_manifest()["lanes"]}
    citation = lanes[11]["cases"][0]
    freshness = lanes[12]["cases"][0]
    conflict = lanes[13]["cases"][0]
    assert score_response(citation, citation["pass_fixture"])["status"] == "PASS"
    assert score_response(freshness, freshness["pass_fixture"])["status"] == "PASS"
    assert score_response(conflict, conflict["pass_fixture"])["status"] == "PASS"


def test_private_tokens_are_not_echoed_and_code_has_boundary_assertions():
    lanes = {lane["number"]: lane for lane in load_manifest()["lanes"]}
    private_case = lanes[17]["cases"][0]
    code_case = lanes[18]["cases"][0]
    assert score_response(private_case, private_case["pass_fixture"])["status"] == "PASS"
    assert score_response(private_case, private_case["fail_fixture"])["status"] == "FAIL"
    assert score_response(code_case, code_case["pass_fixture"])["status"] == "PASS"
    assert score_response(code_case, code_case["fail_fixture"])["status"] == "FAIL"
