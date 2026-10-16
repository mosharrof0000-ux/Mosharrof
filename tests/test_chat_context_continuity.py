from pathlib import Path


def test_worker_uses_bounded_conversation_history_for_all_chat_providers():
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    helper = Path("core/chat-context.js").read_text(encoding="utf-8")
    chat = worker[worker.index("async function runChat(body,env,onStatus){"):worker.index("async function chat(request,env){")]
    assert 'import { buildChatContext } from "../core/chat-context.js"' in worker
    assert "buildChatContext(body.text,body.history)" in chat
    assert "historyInput.slice(-12)" in helper
    assert "Math.min(6000, 12000 - current.length - 200)" in helper
    assert "historyInput.slice(-12)" in helper
    assert "Current user message:" in helper
    assert "generateWithCloudflareChat(text,env,report)" in chat
    assert '"llama-3.1-8b-instant").trim(),text,{},report' in chat
    assert '"meta-llama/llama-3.3-70b-instruct:free").trim(),text,' in chat


def test_prepared_frontend_sends_prior_turns_without_current_message_as_history():
    prep = Path("scripts/prepare_web_organ_runtime.py").read_text(encoding="utf-8")
    assert 'history:(session.messages||[]).slice(0,-1)' in prep
    assert 'm.role==="user"||m.role==="ai"' in prep
    assert 'stream_status:true' in prep
    assert "chat request shape changed" in prep
    wrapper = Path("scripts/android/prepare-wrapper.sh").read_text(encoding="utf-8")
    assert "python3 scripts/prepare_web_organ_runtime.py" in wrapper


def test_every_live_chat_provider_uses_reflective_pre_and_post_response_contract():
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    prompt = Path("core/reflective-chat-prompt.js").read_text(encoding="utf-8")
    assert 'from "../core/reflective-chat-prompt.js"' in worker
    assert "buildReflectiveUserPrompt(text)" in worker
    assert worker.count("buildReflectiveSystemPrompt()") >= 2
    assert "Before answering" in prompt
    assert "Before sending" in prompt
    assert "tentative hypotheses" in prompt
    assert "Do not reveal private chain-of-thought" in prompt
