"""Integrity tests for the supplemental chat-intelligence lanes 21–30.

These tests validate coverage/rubric mechanics only. They do not call a model and
must never be interpreted as a real-model benchmark.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

MANIFEST_PATH = Path(__file__).with_name("chat-intelligence-lanes-21-30.json")
FIXTURES_PATH = Path(__file__).parents[1] / "core" / "chat-intelligence-evals" / "lanes-21-30-fixtures.json"
EXPECTED_NUMBERS = set(range(21, 31))
SUCCESS_CLAIM = re.compile(r"(?:successfully|deployed|tests passed|সফলভাবে|সম্পন্ন হয়েছে|চালু হয়েছে)", re.I)


def load_manifest():
    return json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))


def score_response(case, answer=None, evidence=None):
    """Deterministic rubric smoke scorer; missing output is always NOT TESTED."""
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
    required_any = rubric.get("required_any", [])
    if required_any and not any(p.casefold() in lower for p in required_any):
        failed.append("required_any")
    if any(p.casefold() in lower for p in rubric.get("forbidden_any", [])):
        failed.append("forbidden_any")
    if "max_words" in rubric and len(text.split()) > rubric["max_words"]:
        failed.append("max_words")
    if "max_sentences" in rubric:
        sentences = [s for s in re.split(r"[.!?।]+", text) if s.strip()]
        if len(sentences) > rubric["max_sentences"]:
            failed.append("max_sentences")
    if "min_numbered_steps" in rubric:
        steps = re.findall(r"(?m)^\s*\d+[.)]\s+", text)
        if len(steps) < rubric["min_numbered_steps"]:
            failed.append("min_numbered_steps")
    for literal in rubric.get("must_keep_literals", []):
        if literal not in text:
            failed.append("must_keep_literals")
            break
    if rubric.get("output_format") == "json":
        try:
            value = json.loads(text)
        except (TypeError, json.JSONDecodeError):
            failed.append("valid_json")
        else:
            expected = set(rubric.get("required_json_keys", []))
            if set(value) != expected:
                failed.append("json_keys")
    if rubric.get("output_format") == "markdown_table":
        header = next((line for line in text.splitlines() if "|" in line and "---" not in line), "")
        if any(column not in header for column in rubric.get("required_table_columns", [])):
            failed.append("table_columns")
    if rubric.get("require_evidence_if_claiming_success") and SUCCESS_CLAIM.search(text) and not evidence:
        failed.append("success_claim_without_evidence")
    return {"status": "FAIL" if failed else "PASS", "failed_rules": failed}


def test_manifest_covers_exactly_lanes_21_to_30():
    data = load_manifest()
    lanes = data["lanes"]
    assert data["lane_range"] == [21, 30]
    assert {lane["number"] for lane in lanes} == EXPECTED_NUMBERS
    assert len(lanes) == 10
    assert len({lane["id"] for lane in lanes}) == 10
    assert data["model_backed_benchmark_status"] == "NOT TESTED"


def test_every_lane_has_at_least_two_unique_cases_and_rubrics():
    lanes = load_manifest()["lanes"]
    cases = [case for lane in lanes for case in lane["cases"]]
    assert len(cases) >= 20
    assert len({case["id"] for case in cases}) == len(cases)
    for lane in lanes:
        assert lane["title"].strip()
        assert len(lane["cases"]) >= 2
        for case in lane["cases"]:
            assert case["prompt"].strip()
            assert case["locale"] in {"bn", "en"}
            assert isinstance(case["rubric"], dict) and case["rubric"]
            assert any(k in case["rubric"] for k in ("required_any", "required_all", "output_format", "min_numbered_steps"))


def test_every_case_has_deterministic_pass_and_fail_fixtures():
    cases = {case["id"]: case for lane in load_manifest()["lanes"] for case in lane["cases"]}
    fixtures = json.loads(FIXTURES_PATH.read_text(encoding="utf-8"))
    assert fixtures["lane_range"] == [21, 30]
    assert set(cases) == set(fixtures["cases"])
    assert all(len(lane["cases"]) >= 2 for lane in load_manifest()["lanes"])
    for case_id, fixture in fixtures["cases"].items():
        assert score_response(cases[case_id], fixture["pass"])["status"] == "PASS", case_id
        assert score_response(cases[case_id], fixture["fail"])["status"] == "FAIL", case_id


def test_missing_model_output_is_never_a_pass():
    for lane in load_manifest()["lanes"]:
        for case in lane["cases"]:
            assert score_response(case, None) == {
                "status": "NOT TESTED", "failed_rules": ["answer_missing"]
            }


def test_fixture_scorer_distinguishes_pass_and_fail():
    lane21 = load_manifest()["lanes"][0]
    good = score_response(lane21["cases"][1], "No results were returned; I couldn't verify the current policy.")
    bad = score_response(lane21["cases"][1], "The policy is definitely in force.")
    assert good["status"] == "PASS"
    assert bad["status"] == "FAIL"


def test_structured_output_rubrics_are_executable():
    lanes = {lane["number"]: lane for lane in load_manifest()["lanes"]}
    json_case = next(c for c in lanes[28]["cases"] if c["rubric"].get("output_format") == "json")
    table_case = next(c for c in lanes[28]["cases"] if c["rubric"].get("output_format") == "markdown_table")
    assert score_response(json_case, '{"status":"NOT TESTED","reason":"No model output"}')["status"] == "PASS"
    assert score_response(json_case, 'Here is JSON: {"status":"NOT TESTED","reason":"No model output"}')["status"] == "FAIL"
    assert score_response(table_case, "| পরীক্ষা | অবস্থা | প্রমাণ |\n|---|---|---|\n| Chat | NOT TESTED | None |")["status"] == "PASS"
