# Chat AI provider routing

## Intended minimal route

1. **Gemini** (gemini-3.6-flash) is the primary provider.
2. **Cloudflare Workers AI** (@cf/meta/llama-3.3-70b-instruct-fp8-fast) is fallback 1.
3. **Groq** (llama-3.1-8b-instant) is fallback 2, enabled only after a real API request succeeds on the account.

Automatic routing must follow that order and attempt the next provider only after a retryable upstream failure (network error, timeout, rate limit, or provider/server error). Do not retry authentication/configuration errors endlessly; report the missing configuration clearly.

## Credential and evidence rules

- Keep GEMINI_API_KEY, GROQ_API_KEY, and Cloudflare credentials only in server-side secrets/bindings.
- Never put keys in Pages HTML/JavaScript, committed files, URLs, or browser storage.
- The Pages chat client currently calls the external /chat Worker endpoint. Provider fallback must be implemented and verified in that Worker; changing the browser menu alone does not establish server-side fallback.
- A provider is not considered enabled until a real authenticated chat request returns a non-empty model-generated answer.
- Record provider/model, attempted providers, status, and latency without logging prompts or secrets.
- Keep UI/CI checks, Worker API checks, live Pages checks, and physical Android checks as separate evidence.

## Current implementation status

This document and the provider selector define the intended minimal route. The Worker implementation and account-specific credentials must still be checked independently before claiming that all three providers are live or that fallback works.
