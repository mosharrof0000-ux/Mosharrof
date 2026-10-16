from pathlib import Path
import subprocess


def test_personal_memory_engine_persistence_retrieval_and_unbounded_ledger():
    script = Path("tests/test_personal_memory_engine.mjs")
    subprocess.run(["node", str(script)], check=True, timeout=30)



def test_personal_memory_client_is_wired_into_generated_pages_runtime():
    client = Path("core/personal-memory-client.js").read_text(encoding="utf-8")
    prep = Path("scripts/prepare_web_organ_runtime.py").read_text(encoding="utf-8")
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    assert "export function createBrowserPersonalMemory" in client
    assert "function observe(text)" in client
    assert "function context(text)" in client
    assert "function command(text)" in client
    assert "function recordTurn(userText)" in client
    assert "core/personal-memory-client.js" in prep
    assert "core/personal-memory-engine.js" in prep
    assert 'import("./personal-memory-client.js")' in prep
    assert "personalMemoryContext(currentText)" in prep
    assert "memorySignals(currentText)" in prep
    assert "body.memory_context" in worker
    assert "let video_tag" not in prep
