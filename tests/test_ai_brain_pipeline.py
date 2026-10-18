from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_live_worker_applies_reflective_brain_contract_to_every_chat_provider():
    worker = (ROOT / "worker/screenshot-analysis.js").read_text(encoding="utf-8")
    router = (ROOT / "core/manual-chat-routing.js").read_text(encoding="utf-8")
    prompt = (ROOT / "core/reflective-chat-prompt.js").read_text(encoding="utf-8")
    assert 'import { buildReflectiveSystemPrompt, buildReflectiveUserPrompt } from "../core/reflective-chat-prompt.js"' in worker
    assert "buildReflectiveSystemPrompt()" in worker
    assert "buildReflectiveUserPrompt(text,{targetWords})" in worker
    assert "generateWithCloudflareChat(fallbackText,env,report,targetWords)" in worker
    assert "api.groq.com/openai/v1/chat/completions" in router
    assert "openrouter.ai/api/v1/chat/completions" in router
    assert "dated, potentially incomplete context" in prompt
    assert "current request overrides older preferences" in prompt
    assert "Never invent sources, links, test results, capabilities, or completed actions" in prompt


def test_brain_contract_requires_verification_and_recovery_for_implementation_work():
    prompt = (ROOT / "core/reflective-chat-prompt.js").read_text(encoding="utf-8")
    assert "add or update tests" in prompt
    assert "only verified results" in prompt
    assert "a recovery strategy" in prompt
    assert "distinguishes plans from completed actions" in prompt
