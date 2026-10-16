from pathlib import Path


def test_worker_uses_bounded_conversation_history_for_all_chat_providers():
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    chat = worker[worker.index("async function runChat(body,env,onStatus){"):worker.index("async function chat(request,env){")]
    assert "Array.isArray(body.history)" in chat
    assert "body.history.slice(-12)" in chat
    assert "let historyBudget=6000" in chat
    assert "Current user message:" in chat
    assert "generateWithCloudflareChat(modelText,env,report)" in chat
    assert '"llama-3.1-8b-instant").trim(),modelText,{},report' in chat
    assert '"meta-llama/llama-3.3-70b-instruct:free").trim(),modelText,' in chat
    assert '\\n\\n"+modelText' in chat


def test_prepared_frontend_sends_prior_turns_without_current_message_as_history():
    prep = Path("scripts/prepare_web_organ_runtime.py").read_text(encoding="utf-8")
    assert 'history:(session.messages||[]).slice(0,-1)' in prep
    assert 'm.role==="user"||m.role==="ai"' in prep
    assert 'stream_status:true' in prep
    assert "chat request shape changed" in prep
