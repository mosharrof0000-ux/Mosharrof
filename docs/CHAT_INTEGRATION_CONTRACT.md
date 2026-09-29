# Mosharrof Chat Integration Contract — P1

Status: PROVIDER IDENTIFIED / FRONTEND WIRED — AWAITING WORKER URL + LIVE VERIFY
Date: 2026-09-29
Branch: feature/p1-real-chat-gemini-worker

## Verified production provider (do not invent)

| Field | Value |
|-------|-------|
| Script | `worker/screenshot-analysis.js` |
| Chat path | `POST /chat` |
| Body | `{ "text": "..." }` |
| Auth | `env.GEMINI_API_KEY` (Cloudflare secret) |
| Model | `env.GEMINI_CHAT_MODEL` or `gemini-2.5-flash` |
| Upstream | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` |
| CORS origin | `https://mosharrof0000-ux.github.io` only |
| Deploy | `.github/workflows/deploy-screenshot-worker.yml` |
| Required secrets | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `GEMINI_API_KEY` |

Success response: `{ "ok": true, "model": "...", "text": "..." }`  
Errors: `chat_provider_not_configured` (503), `chat_provider_failed` (502), `empty_model_response` (502), origin/method validation.

## Frontend wiring (this branch)

`web/index.html` (Pages artifact) now:
1. POSTs user text to `CHAT_WORKER_URL` + `/chat`
2. Shows model reply on success
3. Shows honest error messages on failure (no fake AI answer)
4. Timeout 45s; offline/network errors surfaced clearly

`CHAT_WORKER_URL` is a single constant at the top of the script.  
**You must set it to the live workers.dev URL after the worker is deployed.**

## Still required from human / ops
1. Ensure GitHub secrets exist and worker is deployed (`workflow_dispatch` on deploy-screenshot-worker).
2. Copy the live Worker URL into `CHAT_WORKER_URL` in `web/index.html`.
3. Merge after tests + live chat verification.

## Do not do
- Do not hard-code API keys in the browser.
- Do not replace the V5 UI wholesale.
- Do not pretend DeterministicAdapter is a real model.
- Do not merge to main until live `/chat` returns real Gemini text.

## Handoff marker
MOSHARROF-P1-PROVIDER-FOUND-2026-09-29
