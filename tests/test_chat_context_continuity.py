from pathlib import Path


def test_worker_uses_bounded_conversation_history_for_all_chat_providers():
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    helper = Path("core/chat-context.js").read_text(encoding="utf-8")
    chat = worker[worker.index("async function runChat(body,env,onStatus){"):worker.index("async function chat(request,env){")]
    assert 'import { buildChatContext } from "../core/chat-context.js"' in worker
    assert "buildChatContext(body.text,body.history,body.memory_context)" in chat
    assert "historyInput.slice(-12)" in helper
    assert "Math.min(6000, 12000 - current.length - memory.length - 200)" in helper
    assert "Current user message:" in helper
    assert "generateWithCloudflareChat(fallbackText,env,report,targetWords)" in chat
    assert '"llama-3.1-8b-instant").trim(),fallbackText,{},report,targetWords' in chat
    assert '"meta-llama/llama-3.3-70b-instruct:free").trim(),fallbackText,' in chat


def test_prepared_frontend_sends_prior_turns_without_current_message_as_history():
    patch = Path("scripts/manual_provider_runtime_patch.py").read_text(encoding="utf-8")
    assert 'history:(session.messages||[]).slice(0,-1)' in patch
    assert 'm.role==="user"||m.role==="ai"' in patch
    assert 'stream_status:true' in patch
    assert "chat request shape changed" in patch
    wrapper = Path("scripts/android/prepare-wrapper.sh").read_text(encoding="utf-8")
    assert "python3 scripts/prepare_web_organ_runtime.py" in wrapper


def test_context_boundary_bengali_and_current_request_contract():
    h = Path("core/chat-context.js").read_text(encoding="utf-8")
    p = Path("core/reflective-chat-prompt.js").read_text(encoding="utf-8")
    assert "use as context, not as proof of facts" in h
    assert "current request overrides older preferences" in p
    assert "use Bengali when appropriate" in p
