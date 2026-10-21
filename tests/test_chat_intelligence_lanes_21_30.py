"""Fixture-only contract tests for chat-intelligence lanes 21-30.
They validate the manifest and scorer; they do not call an LLM or prove model quality.
"""
import json
import re
from pathlib import Path

MANIFEST = Path(__file__).with_name("chat_intelligence_lanes_21_30_manifest.json")
EXPECTED = {
 "tool_selection_and_result_interpretation","calibrated_confidence_and_abstention",
 "concise_detailed_adaptation","multilingual_understanding_and_translation",
 "domain_boundary_awareness","safe_refusal_and_alternatives",
 "planning_prioritization_dependencies","structured_output_adherence",
 "reproducibility_regression_protection","accessibility_aware_responses",
}

def sentence_count(text):
    return len(re.findall(r"[.!?।]+", text))

def score(text, rules):
    errors=[]
    folded=text.casefold()
    for token in rules.get("must_include", []):
        if token.casefold() not in folded: errors.append("missing:"+token)
    for token in rules.get("must_not_include", []):
        if token.casefold() in folded: errors.append("forbidden:"+token)
    if "max_sentences" in rules and sentence_count(text)>rules["max_sentences"]: errors.append("too_many_sentences")
    if "min_sentences" in rules and sentence_count(text)<rules["min_sentences"]: errors.append("too_few_sentences")
    if "line_count" in rules and len(text.splitlines())!=rules["line_count"]: errors.append("wrong_line_count")
    ordered=rules.get("ordered_include", [])
    if ordered:
        positions=[folded.find(token.casefold()) for token in ordered]
        if any(pos<0 for pos in positions): errors.append("missing_ordered_token")
        elif positions!=sorted(positions): errors.append("wrong_token_order")
    if "json_keys" in rules:
        try: parsed=json.loads(text)
        except json.JSONDecodeError: errors.append("invalid_json")
        else:
            if not isinstance(parsed,dict) or set(parsed)!=set(rules["json_keys"]): errors.append("wrong_json_keys")
    return errors

def load_manifest():
    return json.loads(MANIFEST.read_text(encoding="utf-8"))

def test_manifest_covers_exactly_lanes_21_to_30():
    doc=load_manifest()
    assert [lane["id"] for lane in doc["lanes"]]==list(range(21,31))
    assert {lane["key"] for lane in doc["lanes"]}==EXPECTED
    assert len({lane["key"] for lane in doc["lanes"]})==10
    assert doc["model_benchmark"]["status"]=="NOT TESTED"

def test_each_lane_has_two_unique_cases():
    doc=load_manifest()
    cases=[case for lane in doc["lanes"] for case in lane["cases"]]
    assert len(cases)==20
    assert len({case["id"] for case in cases})==20
    assert all(len(lane["cases"])>=2 for lane in doc["lanes"])
    assert all(case.get("prompt") and case.get("expected") and case.get("rules") for case in cases)

def test_pass_and_fail_fixtures_exercise_the_rules():
    doc=load_manifest()
    for lane in doc["lanes"]:
        for case in lane["cases"]:
            assert score(case["pass_fixture"],case["rules"])==[], case["id"]
            assert score(case["fail_fixture"],case["rules"]), f"fail fixture escaped: {case['id']}"

def test_model_benchmark_is_not_misreported_as_pass():
    doc=load_manifest()
    assert doc["model_benchmark"]["status"]=="NOT TESTED"
    assert doc["model_benchmark"]["reason"]
