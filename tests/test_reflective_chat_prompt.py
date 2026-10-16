from pathlib import Path


def test_live_chat_providers_use_reflective_pre_and_post_response_contract():
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    prompt = Path("core/reflective-chat-prompt.js").read_text(encoding="utf-8")
    assert 'from "../core/reflective-chat-prompt.js"' in worker
    assert "buildReflectiveUserPrompt(text,{targetWords})" in worker
    assert "buildChatContext(body.text,body.history,body.memory_context)" in worker
    assert worker.count("buildReflectiveSystemPrompt()") >= 2
    assert "Before answering" in prompt
    assert "Before sending" in prompt
    assert "tentative hypotheses" in prompt
    assert "Do not reveal private chain-of-thought" in prompt
