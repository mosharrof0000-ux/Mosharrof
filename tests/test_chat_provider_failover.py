from pathlib import Path
import subprocess


def test_chat_failover_has_keyless_cloudflare_fallback_and_optional_providers():
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    assert "async function generateWithCloudflareChat" in worker
    assert "env.AI.run(model" in worker
    assert '"@cf/zai-org/glm-4.7-flash,@cf/meta/llama-3.3-70b-instruct-fp8-fast"' in worker
    assert "async function generateWithOpenAICompatibleChat" in worker
    assert 'String(env.GROQ_API_KEY||"").trim()' in worker
    assert 'String(env.OPENROUTER_API_KEY||"").trim()' in worker
    assert '["primary",String(env.GEMINI_API_KEY||"").trim()]' in worker
    assert '["project5",String(env.GEMINI_API_KEY_5||"").trim()]' in worker
    assert 'chat_provider_order:["gemini","cloudflare-workers-ai","groq","openrouter"]' in worker


def test_chat_provider_order_is_gemini_then_workers_ai_then_optional_fallbacks():
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    chat = worker[worker.index("async function runChat(body,env,onStatus){"):worker.index("async function chat(request,env){")]
    gemini_loop = chat.index("const geminiPlan=[]")
    cloudflare = chat.index("generateWithCloudflareChat(fallbackText,env,report,targetWords)")
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
    assert 'const WORKER_BUILD_ID="2026-10-16-cf-v5";' in worker


def test_chat_providers_have_bounded_timeouts_so_failover_can_continue():
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    assert "const CHAT_PROVIDER_TIMEOUT_MS=12000;" in worker
    assert "signal:AbortSignal.timeout(timeoutMs)" in worker
    assert "const LONG_CHAT_PROVIDER_TIMEOUT_MS=120000;" in worker
    assert "signal:AbortSignal.timeout(targetWords>1000?LONG_CHAT_PROVIDER_TIMEOUT_MS:CHAT_PROVIDER_TIMEOUT_MS)" in worker
    assert 'withChatProviderTimeout(env.AI.run(model' in worker
    assert 'targetWords>1000?LONG_CHAT_PROVIDER_TIMEOUT_MS:CHAT_PROVIDER_TIMEOUT_MS,"cloudflare_workers_ai"' in worker
    assert "max_tokens:targetWords?Math.min(8192,outputTokenBudget(targetWords)):1024" in worker


def test_worker_javascript_parses_with_node():
    subprocess.run(["node", "--check", "worker/screenshot-analysis.js"], check=True)


def test_deploy_workflow_keeps_optional_provider_keys_server_side():
    workflow = Path(".github/workflows/deploy-gemini-worker.yml").read_text(encoding="utf-8")
    assert "RAW_GROQ: ${{ secrets.GROQ_API_KEY }}" in workflow
    assert "RAW_OPENROUTER: ${{ secrets.OPENROUTER_API_KEY }}" in workflow
    assert "secret put GROQ_API_KEY" in workflow
    assert "secret put OPENROUTER_API_KEY" in workflow
    assert '"cloudflare_chat_configured":true' in workflow
    assert "2026-10-16-cf-v5" in workflow


def test_cloudflare_image_engine_has_free_first_model_fallbacks():
    worker = Path("worker/screenshot-analysis.js").read_text(encoding="utf-8")
    assert "@cf/black-forest-labs/flux-1-schnell" in worker
    assert "@cf/bytedance/stable-diffusion-xl-lightning" in worker
    assert "@cf/lykon/dreamshaper-8-lcm" in worker


def test_deploy_workflow_configures_four_keyless_cloudflare_chat_models():
    workflow = Path(".github/workflows/deploy-gemini-worker.yml").read_text(encoding="utf-8")
    assert "Configure keyless Cloudflare chat model fallback list" in workflow
    assert "secret put CLOUDFLARE_CHAT_MODELS" in workflow
    for model in ("@cf/zai-org/glm-4.7-flash", "@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/google/gemma-4-26b-a4b-it", "@cf/meta/llama-4-scout-17b-16e-instruct"):
        assert model in workflow
