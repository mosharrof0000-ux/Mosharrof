import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_gemini_structured_plan_accepts_escaped_newlines_and_tabs_in_strings():
    raw = '{"summary":"generated file","files":[{"path":"docs/example.md","content":"line one\\nline two\\tindented"}]}'
    parsed = json.loads(raw)
    assert parsed["files"][0]["content"] == "line one\nline two\tindented"


def test_gemini_structured_plan_accepts_literal_control_characters_in_strings():
    raw = '{"summary":"generated file","files":[{"path":"docs/example.md","content":"line one\nline two\tindented"}]}'
    parsed = json.loads(raw, strict=False)
    assert parsed["files"][0]["content"] == "line one\nline two\tindented"


def test_autonomous_engine_uses_lenient_parse_for_both_provider_paths():
    source = (ROOT / "scripts/mosharrof_autonomous_engine.py").read_text(encoding="utf-8")
    assert "json.loads(provider_text, strict=False)" in source
    assert 'json.loads(data["candidates"][0]["content"]["parts"][0]["text"], strict=False)' in source
