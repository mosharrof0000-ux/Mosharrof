# Free Edge-TTS provider setup (staged; not live yet)

## Goal

Use the existing `services/edge-tts-api` FastAPI service as an optional Bengali text-to-speech provider, while keeping the current Gemini path and public Worker routes unchanged. The repository already contains the service and Dockerfile; it is **not deployed** until a hosting URL is configured.

## Free-host option

A Docker-based Hugging Face Space is one possible no-card starting point, subject to the provider's current free-tier limits and acceptable-use terms. Free Spaces can sleep or be rate-limited, so this must remain a fallback—not a guaranteed always-on service. Edge-TTS is an unofficial client of Microsoft's online speech service; upstream changes can interrupt it.

## Deployment steps

1. Sign in to Hugging Face and create a new **Space** using the **Docker** SDK.
2. Use a private Space if available on the chosen plan; do not put tokens in source files.
3. Copy the contents of `services/edge-tts-api/` into the Space repository, including `Dockerfile`, `requirements.txt`, and `main.py`.
4. In the Space settings, add a secret named `EDGE_TTS_API_TOKEN` with a newly generated, long random value. Keep it private; never commit it or send it in chat.
5. Wait for the Space build, then check `https://YOUR-SPACE-HOST/health`. Expected JSON includes `ok: true` and `provider: Edge-TTS`.
6. In Cloudflare Worker environment variables/secrets, configure:
   - `EDGE_TTS_API_URL` = `https://YOUR-SPACE-HOST/tts`
   - `EDGE_TTS_API_TOKEN` = the same secret value, stored as a Worker secret (not a plain public variable).
   - Keep the existing `GEMINI_API_KEY` and Gemini settings unchanged.
7. Run the repository's Worker tests and then test Bengali TTS with a short, non-sensitive sentence. Check the response audio type and provider diagnostic before relying on the fallback.

## Safety and rollback

- Do not remove or rotate the current Gemini key as part of this setup.
- Do not add the host URL until `/health` works and the token-protected `/tts` endpoint has been tested.
- The Worker already treats Edge-TTS as unavailable when `EDGE_TTS_API_URL` is empty; leaving it empty preserves current behavior.
- If Edge-TTS fails or the free host sleeps, remove/clear `EDGE_TTS_API_URL` in Worker settings to disable this provider and retain the existing path.
- Never expose `EDGE_TTS_API_TOKEN` in browser JavaScript, logs, issues, commits, screenshots, or chat.
- This guide does not deploy the service or change live Worker settings by itself.

## Current status

- Service code and Dockerfile: present in the repository.
- External free host: not created/verified.
- Worker Edge-TTS URL/secret: not configured/verified.
- Live Bengali fallback: not yet confirmed.
