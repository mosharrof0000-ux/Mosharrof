from pathlib import Path


def test_personal_memory_engine_is_loaded_without_mutating_frozen_index():
    sidebar = Path("web/sidebar-recovery.js").read_text(encoding="utf-8")
    bootstrap = Path("web/personal-memory-bootstrap.js").read_text(encoding="utf-8")
    engine = Path("core/personal-memory/memory-engine.js").read_text(encoding="utf-8")
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    assert 'import("./personal-memory-bootstrap.js")' in sidebar
    assert 'indexedDB.open(DB_NAME, DB_VERSION)' in bootstrap
    assert 'body.memory_context = await engine.buildContext(body.text, conversationId)' in bootstrap
    assert 'buildChatContext(body.text,body.history,body.memory_context)' in worker
    assert 'export function createMemoryEngine' in engine
    assert 'memory/' in engine
    assert 'Memory policy: current user message and current conversation take priority.' in engine
    assert 'maxEntries' not in engine
    assert 'exportAll' in engine and 'clearAll' in engine
