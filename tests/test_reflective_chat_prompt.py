from pathlib import Path


def test_live_chat_providers_use_reflective_pre_and_post_response_contract():
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    memory_prompt = Path("core/chat-memory-context.js").read_text(encoding="utf-8")
    prompt = Path("core/reflective-chat-prompt.js").read_text(encoding="utf-8")
    assert 'from "../core/chat-memory-context.js"' in worker
    assert "buildChatMemoryPrompt(body,text,targetWords)" in worker
    assert "buildReflectiveUserPrompt(contextualText)" in memory_prompt
    assert worker.count("buildReflectiveSystemPrompt()") >= 2
    assert "Before answering" in prompt
    assert "Before sending" in prompt
    assert "tentative hypotheses" in prompt
    assert "Do not reveal private chain-of-thought" in prompt
