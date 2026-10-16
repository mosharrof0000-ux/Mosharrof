from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_live_worker_applies_reflective_brain_contract_to_every_chat_provider():
    worker = (ROOT / "worker/screenshot-analysis.js").read_text(encoding="utf-8")
    prompt = (ROOT / "core/reflective-chat-prompt.js").read_text(encoding="utf-8")
    assert 'import { buildReflectiveSystemPrompt, buildReflectiveUserPrompt } from "../core/reflective-chat-prompt.js"' in worker
    assert "buildReflectiveSystemPrompt()" in worker
    assert "buildReflectiveUserPrompt(text,{targetWords})" in worker
    assert "generateWithCloudflareChat(fallbackText,env,report,targetWords)" in worker
    assert 'generateWithOpenAICompatibleChat(\n    "groq"' in worker
    assert 'generateWithOpenAICompatibleChat(\n    "openrouter"' in worker
    assert "Treat personal memory and conversation history as dated, potentially incomplete context" in prompt
    assert "Never treat a prediction as permission to act" in prompt
    assert "Never invent test results, links, sources, capabilities, completed work" in prompt


def test_brain_contract_requires_verification_and_recovery_for_implementation_work():
    prompt = (ROOT / "core/reflective-chat-prompt.js").read_text(encoding="utf-8")
    assert "add or update tests" in prompt
    assert "which checks actually passed" in prompt
    assert "a recovery strategy" in prompt
    assert "did I distinguish a plan from completed action" in prompt
