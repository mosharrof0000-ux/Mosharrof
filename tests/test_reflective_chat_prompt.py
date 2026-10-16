from pathlib import Path


def test_live_chat_providers_use_reflective_pre_and_post_response_contract():
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    prompt = Path("core/reflective-chat-prompt.js").read_text(encoding="utf-8")
    assert 'from "../core/reflective-chat-prompt.js"' in worker
    assert "buildReflectiveUserPrompt(text,{targetWords})" in worker
    assert worker.count("buildReflectiveSystemPrompt()") >= 2
    assert "explicit request" in prompt
    assert "current request and correction override old memory" in prompt
    assert "never diagnose or claim mind-reading" in prompt
    assert "Never reveal private chain-of-thought" in prompt
