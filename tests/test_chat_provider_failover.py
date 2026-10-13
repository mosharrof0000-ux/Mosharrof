from pathlib import Path


def test_chat_failover_has_keyless_cloudflare_fallback_and_optional_providers():
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    assert "async function generateWithCloudflareChat" in worker
    assert "env.AI.run(model" in worker
    assert "async function generateWithOpenAICompatibleChat" in worker
    assert 'String(env.GROQ_API_KEY||"").trim()' in worker
    assert 'String(env.OPENROUTER_API_KEY||"").trim()' in worker
    assert '["primary",String(env.GEMINI_API_KEY||"").trim()]' in worker
    assert '["project5",String(env.GEMINI_API_KEY_5||"").trim()]' in worker
    assert 'chat_provider_order:["gemini","cloudflare-workers-ai","groq","openrouter"]' in worker


def test_chat_provider_order_is_gemini_then_workers_ai_then_optional_fallbacks():
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    chat = worker[worker.index("async function chat(request,env){"):worker.index("async function handleRequest(request,env){")]
    gemini_loop = chat.index("for(const model of preferred)")
    cloudflare = chat.index("generateWithCloudflareChat(text,env)")
    groq = chat.index('"groq","https://api.groq.com/openai/v1/chat/completions"')
    openrouter = chat.index('"openrouter","https://openrouter.ai/api/v1/chat/completions"')
    assert gemini_loop < cloudflare < groq < openrouter
    assert 'provider:"gemini"' in chat
    assert 'provider:cloudflare.provider' in chat
    assert 'provider:groq.provider' in chat
    assert 'provider:openrouter.provider' in chat


def test_worker_health_reports_provider_configuration_without_secret_values():
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    assert 'cloudflare_chat_configured:!!env.AI' in worker
    assert 'groq_chat_configured:!!env.GROQ_API_KEY' in worker
    assert 'openrouter_chat_configured:!!env.OPENROUTER_API_KEY' in worker
    assert 'gemini_chat_key_slots:[!!env.GEMINI_API_KEY' in worker
    assert 'worker_build:"2026-10-13-chat-multi-provider-failover-v1"' in worker


def test_deploy_workflow_keeps_optional_provider_keys_server_side():
    workflow = Path(".github/workflows/deploy-gemini-worker.yml").read_text(encoding="utf-8")
    assert "RAW_GROQ: ${{ secrets.GROQ_API_KEY }}" in workflow
    assert "RAW_OPENROUTER: ${{ secrets.OPENROUTER_API_KEY }}" in workflow
    assert "secret put GROQ_API_KEY" in workflow
    assert "secret put OPENROUTER_API_KEY" in workflow
    assert '"cloudflare_chat_configured":true' in workflow
    assert "2026-10-13-chat-multi-provider-failover-v1" in workflow
