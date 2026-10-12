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
