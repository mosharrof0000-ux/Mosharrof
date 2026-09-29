# MOSHARROF — CONTINUITY / HANDOFF CONTROL
Version: 2026-09-29
Status: P1 PROVIDER IDENTIFIED; FRONTEND WIRED; LIVE WORKER URL REQUIRED
Branch: feature/p1-real-chat-gemini-worker
Base commit: 989c8db1db3e5a6d8015af46689bf26a4448ecb0

## PURPOSE
This is the first file an AI/agent must read when continuing Mosharrof work.
Never assume unfinished work is complete.

## SAFETY RULES
1. No direct experiments on main/live.
2. Isolated branch first.
3. No deletion of repository/project/critical assets.
4. No live-success claim without deployment + live verification.
5. Every step leaves commit + updated handoff status.
6. Preserve the two-side drawer system.
7. Preserve the V5 visual baseline; integrate rather than wholesale replace.
8. Never fake an AI/model response when a real provider is not connected.

## IMPLEMENTATION ROADMAP
P0 Foundation — DONE
P1 Real Chat — PROVIDER FOUND + UI WIRED (pending live Worker URL + verify)
P2 Memory / History
P3 Entity Integration
P4 Library / Project
P5 Voice
P6 Research Tools / Tool Factory
P7 Quran Research
P8 Test + workflow verification + live verification + promotion

## TWO-SIDE NAVIGATION CONTRACT
LEFT = core/navigation: Home, Chat, Chat History, Memory/Knowledge, Library, Projects, Notes, Voice, Settings, Profile.
RIGHT = active work/research: Quran Research, Research Lab, Research Memory, Knowledge Library, Research Tools, Tool Factory, Voice Research, Project Files, New Entity/Module.

## CURRENT PHASE
P1 — REAL CHAT

## LAST COMPLETED ACTION
Identified production model provider: Cloudflare Worker `worker/screenshot-analysis.js` with `POST /chat` using `GEMINI_API_KEY`. Wired V5 Pages UI (`web/index.html`) to call that endpoint with honest error fallbacks. Updated `config/model_registry.json` and contract docs.

## VERIFIED FINDINGS
- Provider script: worker/screenshot-analysis.js
- Chat contract: POST /chat body `{text}` → `{ok, model, text}`
- Secret: GEMINI_API_KEY (Cloudflare Worker secret, set by deploy-screenshot-worker.yml)
- CORS locked to https://mosharrof0000-ux.github.io
- Pages artifact path: ./web (web/index.html)
- Live Worker URL was not present in repo; must be filled into CHAT_WORKER_URL after deploy

## TESTS
Branch creation: SUCCESS
Provider identification: SUCCESS
Frontend wiring: DONE on this branch
Live chat with Gemini: NOT YET VERIFIED (needs deployed Worker URL + secrets)

## BLOCKER (remaining)
1. Cloudflare Worker must be deployed (secrets: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, GEMINI_API_KEY).
2. Set `CHAT_WORKER_URL` in web/index.html to the live workers.dev base URL.
3. Live verify a real reply, then promote via PR.

## EXACT NEXT ACTION
Deploy worker → paste live base URL into CHAT_WORKER_URL → open Pages (or PR preview) → send a message → confirm Gemini reply → merge.

## DO NOT TOUCH
- main/live without verification
- hard-coded API keys in browser
- V5 UI wholesale replacement
- fake AI success responses

## CONTINUITY MARKER
MOSHARROF-P1-PROVIDER-FOUND-2026-09-29
