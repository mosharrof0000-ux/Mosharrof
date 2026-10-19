from pathlib import Path
import ast


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
    source = (ROOT / "scripts/mosharrof_autonomous_engine.py").read_text(encoding="utf-8")
    cloudflare = source.index('"Cloudflare Workers AI"')
    groq = source.index('"Groq"')
    openrouter = source.index('"OpenRouter"')
    assert cloudflare < groq < openrouter
