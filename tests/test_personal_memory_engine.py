from pathlib import Path


def test_personal_memory_engine_wiring_and_current_request_priority():
    engine = Path("core/personal-memory-engine.js").read_text(encoding="utf-8")
    ui = Path("core/personal-memory-ui.js").read_text(encoding="utf-8")
    prep = Path("scripts/prepare_web_organ_runtime.py").read_text(encoding="utf-8")
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    context = Path("core/chat-context.js").read_text(encoding="utf-8")
    prompt = Path("core/reflective-chat-prompt.js").read_text(encoding="utf-8")
    assert '"core/personal-memory-engine.js": "web/memory-engine.js"' in prep
    assert '"core/personal-memory-ui.js": "web/memory-ui.js"' in prep
    assert '<script src="./memory-engine.js"></script>' in prep
    assert '<script src="./memory-ui.js"></script>' in prep
    assert 'createObjectStore(STORE, { keyPath: "id" })' in engine
    assert 'store.createIndex("topic"' in engine
    assert "async function contextFor(query)" in engine
    assert "payload.memory_context = await contextFor(userText)" in engine
    assert "current request overrides it" in context
    assert "Current user message:" in context
    assert "current request" in prompt
    assert "সব মুছুন" in ui and "এই স্মৃতি মুছুন" in ui
    assert "async function clear()" in engine
    assert "async function remove(id)" in engine
