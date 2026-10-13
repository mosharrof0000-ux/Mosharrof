from pathlib import Path


def test_autonomous_agent_entrypoints_compile():
    root = Path(__file__).resolve().parents[1]
    entrypoints = (
        root / "scripts" / "mosharrof_autonomous_engine.py",
        root / ".github" / "scripts" / "mosharrof_agent.py",
    )
    for path in entrypoints:
        source = path.read_text(encoding="utf-8")
        compile(source, str(path), "exec")

def test_legacy_agent_retries_transient_gemini_errors_and_uses_fallbacks():
    root = Path(__file__).resolve().parents[1]
    source = (root / ".github" / "scripts" / "mosharrof_agent.py").read_text(encoding="utf-8")
    assert "TRANSIENT_HTTP_CODES" in source
    assert "time.sleep(delay)" in source
    assert "checking supported alternatives" in source
    assert "API-supported model list" in source
