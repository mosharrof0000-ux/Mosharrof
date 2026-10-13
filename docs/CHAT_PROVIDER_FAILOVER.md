# MOSHARROF AI chat provider failover

The chat Worker keeps the current frontend API contract (POST /chat with a JSON body containing text) and tries providers in this order:

1. **Gemini** — configured Flash models, with any authorized GEMINI_API_KEY through GEMINI_API_KEY_5 credentials tried as alternatives.
2. **Cloudflare Workers AI** — uses the existing AI binding; no separate model API key is required. The default model order is @cf/zai-org/glm-4.7-flash followed by @cf/meta/llama-3.3-70b-instruct-fp8-fast. These defaults avoid the older Llama 3.1 ID deprecated in Cloudflare's May 2026 model refresh. It can be overridden by the Worker variable CLOUDFLARE_CHAT_MODEL or CLOUDFLARE_CHAT_MODELS (comma-separated).
3. **Groq** — optional, configured only when the repository Actions secret GROQ_API_KEY is present. Default model: llama-3.1-8b-instant.
4. **OpenRouter** — optional, configured only when the repository Actions secret OPENROUTER_API_KEY is present. Default model: meta-llama/llama-3.3-70b-instruct:free.

## Behavior

- Each provider call has a 7-second timeout; Gemini and OpenAI-compatible calls are aborted on timeout, and Cloudflare Workers AI is bounded by a timeout race. HTTP quota/rate-limit, unsupported-model, upstream-server, empty-response, timeout, and network failures are recorded as a provider attempt and do not stop the remaining fallback chain.
- A successful response includes provider, model, and a safe attempted list so the client/diagnostics can identify the provider that answered.
- GET /health reports the provider order and configured/not-configured booleans only. It never returns credential values.
- Optional Groq/OpenRouter keys are read from GitHub Actions secrets and written to Cloudflare Worker secrets by the existing deployment workflow; they are never sent to the browser or committed to the repository.
- Cloudflare Workers AI is the keyless fallback already wired into worker/wrangler.toml. Free usage has limits and model availability can change; failover improves resilience but cannot guarantee unlimited free capacity.
- The worker deployment workflow validates the new build ID, chat provider order, and existing audio endpoints before marking deployment healthy.

## Optional setup

To enable the extra providers, add the provider key as a repository Actions secret under **Settings → Secrets and variables → Actions**:

- GROQ_API_KEY
- OPENROUTER_API_KEY

No key is required for Cloudflare Workers AI. Keep all API keys out of frontend code, issues, commits, and chat messages. Use only credentials and provider projects you are authorized to operate.
