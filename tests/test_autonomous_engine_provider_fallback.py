from pathlib import Path
import ast
import json

ROOT = Path(__file__).resolve().parents[1]


def test_autonomous_engine_provider_fallback_script_parses():
    source = (ROOT / "scripts/mosharrof_autonomous_engine.py").read_text(encoding="utf-8")
    ast.parse(source, filename="scripts/mosharrof_autonomous_engine.py")


def test_autonomous_engine_workflow_expressions_are_not_backslash_prefixed():
    workflow = (ROOT / ".github/workflows/mosharrof-autonomous-engine.yml").read_text(encoding="utf-8")
    assert r"\${{" not in workflow
    assert "${{ secrets.GEMINI_API_KEY }}" in workflow
    assert "${{ secrets.CLOUDFLARE_API_TOKEN }}" in workflow
    assert "${{ secrets.GROQ_API_KEY }}" in workflow
    assert "${{ secrets.OPENROUTER_API_KEY }}" in workflow


def test_autonomous_engine_keeps_configured_fallback_order():
    source = (ROOT / "scripts/automation/provider_fallback.py").read_text(encoding="utf-8")
    cloudflare = source.index('"Cloudflare Workers AI"')
    groq = source.index('"Groq"')
    openrouter = source.index('"OpenRouter"')
    assert cloudflare < groq < openrouter


def test_gemini_structured_plan_accepts_escaped_newlines_and_tabs_in_strings():
    # JSON-escaped newlines/tabs are valid JSON, even with strict=True.
    # The regression fix separately allows literal control characters from
    # imperfect provider output via strict=False.
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
