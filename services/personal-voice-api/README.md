# Mosharrof Personal Voice API (prototype)

**Experimental and not connected to the live app.** This is a separate Python inference service. It does not replace Gemini TTS, persist user profiles, or collect microphone audio.

## Model and limitations

- Candidate: [AI4Bharat/IndicF5](https://huggingface.co/ai4bharat/IndicF5), which lists Bengali support and reference-audio synthesis.
- Upstream code is pinned in `requirements.txt`; the model weights require a Hugging Face account and acceptance of the model's current access conditions.
- Before deployment, review the pinned upstream code and all model/dependency terms. The model loader uses `trust_remote_code=True` because the upstream model uses custom code. Do not run an unreviewed revision.
- A reference sample is used for each request; this prototype does not fine-tune model weights and cannot promise an exact voice match.
- The Cloudflare Worker must not host the model itself. CPU-only inference may be slow and free hosting may sleep.

## Required server secrets/configuration

- `PERSONAL_VOICE_API_TOKEN`: strong random bearer token; required for synthesis.
- `HF_TOKEN`: Hugging Face token after the operator has accepted model access conditions.
- `INDICF5_MODEL_REVISION`: exact, reviewed Hugging Face model commit SHA. It is deliberately required; do not set it to `main`.
- Optional limits: `MAX_REFERENCE_AUDIO_BYTES` (default 5 MiB), `MAX_REFERENCE_AUDIO_SECONDS` (default 20), `MAX_SYNTHESIS_TEXT_CHARS` (default 800), `MAX_REFERENCE_TEXT_CHARS` (default 500).

Never place secrets in Git, browser JavaScript, logs, screenshots, or chat. Keep the service private and only expose it through an authenticated server-to-server connection.

## Local smoke test

Use Python 3.10. Do not add real user audio to the repository.

```bash
cd services/personal-voice-api
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
export PERSONAL_VOICE_API_TOKEN='replace-with-a-long-random-secret'
export HF_TOKEN='your-private-hugging-face-token'
export INDICF5_MODEL_REVISION='REVIEWED_MODEL_COMMIT_SHA'
uvicorn main:app --host 127.0.0.1 --port 7860
```

- `GET /health` reports safe readiness flags and never returns secrets.
- `POST /synthesize` accepts multipart fields `text`, `reference_text`, and `reference_audio`, plus `Authorization: Bearer ...`; it returns WAV audio.
- Uploaded audio is decoded in memory and written to a temporary file only for inference; the temporary file is removed after the request. No profile is stored.
- If the service is unconfigured or synthesis fails, the caller must keep using the existing Gemini TTS fallback.

Example request (use a local test recording, never commit it):

```bash
curl -X POST http://127.0.0.1:7860/synthesize \
  -H "Authorization: Bearer $PERSONAL_VOICE_API_TOKEN" \
  -F "text=আসসালামু আলাইকুম, এটি আমার কণ্ঠের পরীক্ষা।" \
  -F "reference_text=আপনার রেকর্ডিংয়ে বলা সঠিক বাক্যটি এখানে লিখুন।" \
  -F "reference_audio=@./private-reference.wav;type=audio/wav" \
  --output preview.wav
```

## Not implemented yet

- Authenticated Mosharrof user identity and multi-tenant profile storage.
- Consent/settings UI, reference enrollment, profile versioning and deletion.
- Candidate-sample review workflow and optional profile improvement.
- Worker integration, feature flag, quotas/rate limits per user, and production observability.

These must be added and tested before any public activation. Ordinary transcription recordings must never be reused for cloning without separate, explicit opt-in and a review flow.
