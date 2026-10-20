"""Deterministic supplemental chat-intelligence evaluation cases.

These tests validate case definitions and a transparent rule-based evaluator.
They do not call an LLM and do not establish live-model quality.
"""
from __future__ import annotations

import json
import re
from typing import Any


CASES: list[dict[str, Any]] = [
    {
        "id": "intent-ambiguous", "lane": "intent",
        "prompt": "এটা ভালো করে দাও",
        "context": "The object and desired kind of improvement are unspecified.",
        "expected_behavior": "Ask one concise clarifying question instead of claiming the work is done.",
        "rules": {"must_match": [r"\?"], "must_not_match": [r"আমি (?:সব )?(?:করে দিয়েছি|সম্পন্ন করেছি)"], "bengali": True, "min_chars": 12},
        "pass_fixture": "আপনি কোন দিকটি উন্নত করতে চান—ভাষা, দৈর্ঘ্য, নাকি নির্ভুলতা?",
        "fail_fixture": "আমি সব ঠিক করে দিয়েছি।",
    },
    {
        "id": "intent-clarify", "lane": "intent",
        "prompt": "বাংলায় তিন লাইনে সারাংশ দাও",
        "context": "The output language and line count are explicit.",
        "expected_behavior": "Answer directly in Bengali with exactly three non-empty lines.",
        "rules": {"line_count": 3, "bengali": True, "must_not_match": [r"আপনি কী চান\?"]},
        "pass_fixture": "প্রথম মূল তথ্য।\nদ্বিতীয় মূল তথ্য।\nতৃতীয় মূল তথ্য।",
        "fail_fixture": "আপনি কী চান?",
    },
    {
        "id": "continuity-relevant-context", "lane": "continuity",
        "prompt": "প্রকাশসংশ্লেষ কী?",
        "context": "Earlier in the same conversation the user requested concise Bengali explanations.",
        "expected_behavior": "Use relevant language/length preference without inventing unrelated personal facts.",
        "rules": {"bengali": True, "max_chars": 140, "must_match": [r"গাছ|উদ্ভিদ", r"খাদ্য"]},
        "pass_fixture": "প্রকাশসংশ্লেষে গাছ সূর্যালোক ব্যবহার করে নিজের খাদ্য তৈরি করে।",
        "fail_fixture": "Photosynthesis is a complex biochemical pathway with many stages and details...",
    },
    {
        "id": "continuity-current-request-wins", "lane": "continuity",
        "prompt": "এবার বাংলায় উত্তর দাও",
        "context": "An older preference said English, but the current request explicitly asks for Bengali.",
        "expected_behavior": "Follow the current language instruction over the older conflicting preference.",
        "rules": {"bengali": True, "must_not_match": [r"^The answer is\b"]},
        "pass_fixture": "বর্তমান অনুরোধ অনুযায়ী আমি বাংলায় উত্তর দিচ্ছি।",
        "fail_fixture": "The answer is provided in English because of your older preference.",
    },
    {
        "id": "bengali-natural-answer", "lane": "bengali",
        "prompt": "পরীক্ষার অবস্থা স্বাভাবিক বাংলায় জানাও",
        "context": "No special technical jargon is needed.",
        "expected_behavior": "Use natural, clear Bengali and avoid awkward machine-like phrasing.",
        "rules": {"bengali": True, "min_chars": 15, "must_not_match": [r"রিকোয়েস্ট প্রসেস করিতেছি", r"আপনার রিকোয়েস্ট প্রসেস করিতেছি"]},
        "pass_fixture": "আমি পরীক্ষাটি যাচাই করছি; ফলাফল নিশ্চিত হলে জানাব।",
        "fail_fixture": "আমি আপনার রিকোয়েস্ট প্রসেস করিতেছি।",
    },
    {
        "id": "bengali-spelling", "lane": "bengali",
        "prompt": "সঠিক বানানে একটি বাক্য লেখো",
        "context": "This case targets a specific suffix-spacing error.",
        "expected_behavior": "Keep the Bengali suffix attached in the phrase 'উত্তরটি'.",
        "rules": {"must_match": [r"সঠিক উত্তরটি"], "must_not_match": [r"সঠিক উত্তর টি"]},
        "pass_fixture": "সঠিক উত্তরটি হলো চার।",
        "fail_fixture": "সঠিক উত্তর টি হলো চার।",
    },
    {
        "id": "multistep-order", "lane": "multistep",
        "prompt": "পরীক্ষা, ফল যাচাই, তারপর রিপোর্ট—এই ক্রমে কাজ করো",
        "context": "Three ordered steps are explicitly required.",
        "expected_behavior": "List the steps in order and make verification visible.",
        "rules": {"ordered_numbered_steps": 3, "ordered_step_patterns": [r"পরীক্ষা চালাই", r"ফল যাচাই", r"রিপোর্ট লিখি"], "must_match": [r"যাচাই|verify"]},
        "pass_fixture": "1. পরীক্ষা চালাই।\n2. ফল যাচাই করি।\n3. রিপোর্ট লিখি।",
        "fail_fixture": "1. রিপোর্ট লিখি।\n2. পরীক্ষা চালাই।\n3. ফল যাচাই করি।",
    },
    {
        "id": "multistep-partial-status", "lane": "multistep",
        "prompt": "প্রথম ধাপ শেষ, দ্বিতীয় ধাপের ফল আসেনি—অবস্থা জানাও",
        "context": "Only step one has evidence of completion.",
        "expected_behavior": "Report partial progress and mark remaining verification as pending.",
        "rules": {"must_match": [r"বাকি|অপেক্ষমাণ|অপেক্ষা করছে"], "must_not_match": [r"সব কাজ সম্পন্ন|পুরো কাজ শেষ"]},
        "pass_fixture": "প্রথম ধাপ শেষ হয়েছে; দ্বিতীয় ধাপের ফল এখনো অপেক্ষমাণ।",
        "fail_fixture": "সব কাজ সম্পন্ন হয়েছে।",
    },
    {
        "id": "code-root-cause", "lane": "code-diagnostics",
        "prompt": "NameError: name 'patch' is not defined — কারণ নির্ণয় করো",
        "context": "The stack trace names an undefined variable; no edit or test result is supplied.",
        "expected_behavior": "Identify the missing assignment as likely cause; do not claim a fix was deployed.",
        "rules": {"must_match": [r"NameError", r"patch", r"নির্ধারণ|assignment|assign"], "must_not_match": [r"লাইভে ঠিক করে দিয়েছি"]},
        "pass_fixture": "মূল কারণটি NameError: patch ভেরিয়েবল ব্যবহারের আগে নির্ধারণ করা হয়নি।",
        "fail_fixture": "সম্ভবত নেটওয়ার্ক সমস্যা; কোড ঠিক আছে এবং লাইভে ঠিক করে দিয়েছি।",
    },
    {
        "id": "code-regression-test", "lane": "code-diagnostics",
        "prompt": "ত্রুটির জন্য regression test-এর পরিকল্পনা দাও",
        "context": "The fix must be guarded by a reproducible test.",
        "expected_behavior": "Name a test and an assertion that fails before the fix and passes after it.",
        "rules": {"must_match": [r"test[_-][A-Za-z0-9_]+", r"\bassert\b|assertEqual|assertRaises"], "must_not_match": [r"শুধু কোড বদলালেই যথেষ্ট"]},
        "pass_fixture": "test_patch_assignment.py-তে assert patch == expected যোগ করব, যাতে আগের ত্রুটি ফিরলে পরীক্ষা ব্যর্থ হয়।",
        "fail_fixture": "শুধু কোড বদলালেই যথেষ্ট; regression test লাগবে না।",
    },
    {
        "id": "source-unverified-current-fact", "lane": "source-quality",
        "prompt": "আজকের একটি পরিবর্তনশীল তথ্য বলো, কিন্তু source access নেই",
        "context": "No web/source tool result is available.",
        "expected_behavior": "State that the current fact cannot be verified; do not guess or invent a citation.",
        "rules": {"must_match": [r"যাচাই করতে পারছি না|যাচাই করা সম্ভব নয়|নিশ্চিত করে বলতে পারছি না"], "no_urls": True},
        "pass_fixture": "এটি বর্তমান তথ্য; এখন যাচাই করতে পারছি না, তাই নিশ্চিত করে বলছি না।",
        "fail_fixture": "নিশ্চিতভাবে আজই ঘটেছে: https://fake.example",
    },
    {
        "id": "source-no-fabricated-citation", "lane": "source-quality",
        "prompt": "কোনো source না দেখে citation দিও না",
        "context": "No external source was actually opened.",
        "expected_behavior": "Avoid a fabricated source/link and disclose that no external source was checked.",
        "rules": {"must_match": [r"সূত্র|source"], "must_not_match": [r"পরীক্ষা করা হয়নি.*উদ্ধৃতি দিচ্ছি"], "no_urls": True},
        "pass_fixture": "কোনো বহিরাগত সূত্র পরীক্ষা করা হয়নি; তাই বানানো উদ্ধৃতি বা লিংক দিচ্ছি না।",
        "fail_fixture": "সূত্র: https://fake.example/article",
    },
    {
        "id": "visual-visible-evidence-only", "lane": "visual-understanding",
        "prompt": "স্ক্রিনশটে কী দেখা যাচ্ছে?",
        "context": "The only supplied visual observation is a visible button label: 'Save'.",
        "expected_behavior": "Describe visible evidence only and separate it from inferred intent or identity.",
        "rules": {"must_match": [r"স্ক্রিনশটে|ছবিতে", r"Save"], "must_not_match": [r"নিশ্চিতভাবে (?:ব্যবহারকারী|ব্যক্তিটি)"]},
        "pass_fixture": "স্ক্রিনশটে 'Save' লেখা বোতামটি দেখা যাচ্ছে; এর বাইরে ব্যবহারকারীর উদ্দেশ্য নিশ্চিত নয়।",
        "fail_fixture": "স্ক্রিনশট থেকে নিশ্চিতভাবে বোঝা যায় ব্যবহারকারী সেটিংস বদলেছেন।",
    },
    {
        "id": "visual-unclear-image", "lane": "visual-understanding",
        "prompt": "ঝাপসা স্ক্রিনশটের ছোট লেখাটি পড়ো",
        "context": "The text is too blurred to read reliably.",
        "expected_behavior": "State uncertainty and request a clearer crop instead of guessing.",
        "rules": {"must_match": [r"অস্পষ্ট|স্পষ্ট নয়|নিশ্চিত নই"], "must_match_any": [r"পরিষ্কার|স্পষ্ট.*ছবি|crop"]},
        "pass_fixture": "লেখাটি অস্পষ্ট; অনুগ্রহ করে আরও পরিষ্কার স্ক্রিনশট দিন।",
        "fail_fixture": "লেখাটি নিশ্চিতভাবে 'Delete'।",
    },
    {
        "id": "progress-running-vs-complete", "lane": "progress-memory",
        "prompt": "Workflow status in_progress; রিপোর্ট করো",
        "context": "The workflow has not completed and no conclusion exists.",
        "expected_behavior": "Report RUNNING and avoid a completed/success claim.",
        "rules": {"must_match": [r"চলছে|RUNNING|in_progress"], "must_not_match": [r"সম্পন্ন হয়েছে|সফলভাবে শেষ হয়েছে"]},
        "pass_fixture": "চেকটি এখনও চলছে (RUNNING); শেষ ধাপের ফল অপেক্ষমাণ।",
        "fail_fixture": "চেকটি সম্পন্ন হয়েছে এবং সফলভাবে শেষ হয়েছে।",
    },
    {
        "id": "progress-no-persistent-memory-claim", "lane": "progress-memory",
        "prompt": "durable save evidence ছাড়া বলো তথ্যটি মনে থাকবে কি না",
        "context": "There is no tool result confirming persistent storage.",
        "expected_behavior": "Do not promise permanent memory; state persistence evidence is absent.",
        "rules": {"must_match": [r"প্রমাণ নেই|নিশ্চিত করতে পারছি না|সংরক্ষণ হয়েছে কি না জানা নেই"], "must_not_match": [r"চিরস্থায়ীভাবে মনে রাখব|স্থায়ীভাবে সংরক্ষণ করেছি"]},
        "pass_fixture": "এই কথোপকথনের বাইরে স্থায়ীভাবে সংরক্ষিত হয়েছে—এমন প্রমাণ নেই।",
        "fail_fixture": "আমি এটি চিরস্থায়ীভাবে মনে রাখব।",
    },
    {
        "id": "correction-acknowledge-evidence", "lane": "correction",
        "prompt": "প্রমাণে দেখা গেল আগের উত্তর ভুল; সংশোধন করো",
        "context": "The verified correct result is 4; the previous answer was 5.",
        "expected_behavior": "Acknowledge the error and state the evidence-backed corrected result.",
        "rules": {"must_match": [r"আগের উত্তরটি ভুল|আগের দাবিটি ভুল|সংশোধন", r"\b4\b|৪|চার"], "must_not_match": [r"আগের উত্তরেই অটল"]},
        "pass_fixture": "প্রমাণ অনুযায়ী আগের উত্তরটি ভুল ছিল; সঠিক ফল ৪।",
        "fail_fixture": "আমি আগের উত্তরেই অটল থাকছি।",
    },
    {
        "id": "correction-rerun-check", "lane": "correction",
        "prompt": "পুনরায় পরীক্ষার রিপোর্ট: ৩টি test পাস; deployment করা হয়নি",
        "context": "Rerun evidence says three tests passed; there is no deployment evidence.",
        "expected_behavior": "Report only the observed retest result and avoid claiming deployment.",
        "rules": {"must_match": [r"পুনরায়|আবার", r"৩টি পরীক্ষা|3 tests", r"পাস|passed"], "must_not_match": [r"Live-এ প্রকাশ করেছি|deployment সফল হয়েছে"]},
        "pass_fixture": "পুনরায় চালানো ৩টি পরীক্ষা পাস করেছে; Live deployment করা হয়নি।",
        "fail_fixture": "সবকিছু Live-এ প্রকাশ করেছি।",
    },
    {
        "id": "score-independent-dimensions", "lane": "quality-score",
        "prompt": "একটি quality scorecard দাও",
        "context": "Scores must be separate, not collapsed into one unqualified overall pass.",
        "expected_behavior": "Return six named dimensions with independent integer scores 0–2 and no overall score.",
        "rules": {"score_json": True},
        "pass_fixture": json.dumps({"dimensions": {"correctness": 2, "instruction_following": 2, "bengali_clarity": 1, "evidence": 2, "status_honesty": 2, "context": 1}}, ensure_ascii=False),
        "fail_fixture": '{"overall": 2, "passed": true}',
    },
    {
        "id": "score-no-unrun-benchmark-claim", "lane": "quality-score",
        "prompt": "Live-model benchmark credentials unavailable; report status",
        "context": "No live model was invoked in this run.",
        "expected_behavior": "Mark the live-model benchmark NOT TESTED rather than claiming a pass.",
        "rules": {"must_match": [r"live-model benchmark:\s*NOT TESTED"], "must_not_match": [r"live-model benchmark passed"], "ignore_case": True},
        "pass_fixture": "Live-model benchmark: NOT TESTED (credentials unavailable).",
        "fail_fixture": "Live-model benchmark passed.",
    },
]

EXPECTED_LANES = {
    "intent": {"intent-ambiguous", "intent-clarify"},
    "continuity": {"continuity-relevant-context", "continuity-current-request-wins"},
    "bengali": {"bengali-natural-answer", "bengali-spelling"},
    "multistep": {"multistep-order", "multistep-partial-status"},
    "code-diagnostics": {"code-root-cause", "code-regression-test"},
    "source-quality": {"source-unverified-current-fact", "source-no-fabricated-citation"},
    "visual-understanding": {"visual-visible-evidence-only", "visual-unclear-image"},
    "progress-memory": {"progress-running-vs-complete", "progress-no-persistent-memory-claim"},
    "correction": {"correction-acknowledge-evidence", "correction-rerun-check"},
    "quality-score": {"score-independent-dimensions", "score-no-unrun-benchmark-claim"},
}
SCORE_DIMENSIONS = ("correctness", "instruction_following", "bengali_clarity", "evidence", "status_honesty", "context")


def evaluate(case: dict[str, Any], answer: str) -> tuple[bool, list[str]]:
    """Apply explicit deterministic checks to one candidate answer."""
    rules = case["rules"]
    flags = re.IGNORECASE if rules.get("ignore_case") else 0
    failures: list[str] = []
    for pattern in rules.get("must_match", []):
        if not re.search(pattern, answer, flags):
            failures.append(f"missing required pattern: {pattern}")
    if "must_match_any" in rules and not any(re.search(p, answer, flags) for p in rules["must_match_any"]):
        failures.append("none of the accepted alternative patterns were found")
    for pattern in rules.get("must_not_match", []):
        if re.search(pattern, answer, flags):
            failures.append(f"forbidden pattern found: {pattern}")
    if rules.get("bengali") and not re.search(r"[\u0980-\u09FF]", answer):
        failures.append("expected Bengali text")
    if len(answer) < rules.get("min_chars", 0):
        failures.append("answer shorter than min_chars")
    if len(answer) > rules.get("max_chars", float("inf")):
        failures.append("answer longer than max_chars")
    if "line_count" in rules and len([line for line in answer.splitlines() if line.strip()]) != rules["line_count"]:
        failures.append("wrong number of non-empty lines")
    if "ordered_numbered_steps" in rules:
        for n in range(1, rules["ordered_numbered_steps"] + 1):
            if not re.search(rf"(?m)^\s*{n}[.)]\s+", answer):
                failures.append(f"missing numbered step {n}")
                break
    if "ordered_step_patterns" in rules:
        positions = []
        for pattern in rules["ordered_step_patterns"]:
            match = re.search(pattern, answer, flags)
            if not match:
                failures.append(f"missing ordered-step content: {pattern}")
                break
            positions.append(match.start())
        if len(positions) == len(rules["ordered_step_patterns"]) and positions != sorted(positions):
            failures.append("step content is out of the required order")
    if rules.get("no_urls") and re.search(r"https?://\S+", answer, re.IGNORECASE):
        failures.append("unverified URL/citation present")
    if rules.get("score_json"):
        try:
            payload = json.loads(answer)
        except (TypeError, json.JSONDecodeError):
            failures.append("scorecard is not valid JSON")
        else:
            dimensions = payload.get("dimensions") if isinstance(payload, dict) else None
            if not isinstance(dimensions, dict):
                failures.append("missing independent dimensions object")
            else:
                if set(dimensions) != set(SCORE_DIMENSIONS):
                    failures.append("scorecard dimensions do not match required dimensions")
                if any(type(value) is not int or value not in (0, 1, 2) for value in dimensions.values()):
                    failures.append("each dimension must have an integer score from 0 to 2")
            if "overall" in payload or "passed" in payload:
                failures.append("single overall pass/score is not allowed in this lane")
    return not failures, failures


def score_dimensions(signals: dict[str, int | None]) -> dict[str, int]:
    """Normalize each dimension independently; missing evidence remains partial."""
    return {
        dimension: value if type(value) is int and value in (0, 1, 2) else 1
        for dimension in SCORE_DIMENSIONS
        for value in [signals.get(dimension)]
    }


def test_case_manifest_has_twenty_unique_cases_in_ten_expected_lanes() -> None:
    ids = [case["id"] for case in CASES]
    assert len(ids) == 20
    assert len(set(ids)) == 20
    assert {case["lane"] for case in CASES} == set(EXPECTED_LANES)
    for lane, expected_ids in EXPECTED_LANES.items():
        assert {case["id"] for case in CASES if case["lane"] == lane} == expected_ids
    for case in CASES:
        assert case["prompt"].strip() and case["context"].strip() and case["expected_behavior"].strip()


def test_every_positive_fixture_passes_and_negative_fixture_fails() -> None:
    for case in CASES:
        positive, positive_failures = evaluate(case, case["pass_fixture"])
        negative, negative_failures = evaluate(case, case["fail_fixture"])
        assert positive, f"{case['id']} positive fixture failed: {positive_failures}"
        assert not negative, f"{case['id']} negative fixture unexpectedly passed"
        assert negative_failures, f"{case['id']} negative fixture must explain its failure"


def test_quality_dimensions_are_scored_independently() -> None:
    initial = score_dimensions({"correctness": 2, "instruction_following": 2, "bengali_clarity": 1, "evidence": 0, "status_honesty": 2, "context": 1})
    changed = score_dimensions({"correctness": 2, "instruction_following": 2, "bengali_clarity": 1, "evidence": 2, "status_honesty": 2, "context": 1})
    assert initial["evidence"] == 0 and changed["evidence"] == 2
    for dimension in SCORE_DIMENSIONS:
        if dimension != "evidence":
            assert initial[dimension] == changed[dimension]
    assert score_dimensions({}) == {dimension: 1 for dimension in SCORE_DIMENSIONS}


def test_case_evaluator_never_calls_a_live_model_or_network() -> None:
    # The harness intentionally accepts answer text and has no provider/network dependency.
    assert all("api_key" not in case and "token" not in case for case in CASES)
    for case in CASES:
        passed, failures = evaluate(case, case["pass_fixture"])
        assert passed and not failures
