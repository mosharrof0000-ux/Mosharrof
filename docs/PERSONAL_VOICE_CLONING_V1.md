# Personal Voice Cloning System — V1 Architecture

Status: design proposal only. This document does not enable voice cloning, create a voice profile, deploy a model, or change the existing TTS router.

## Goal

Let each authenticated Mosharrof user create and use a Bengali voice profile that resembles their own voice, starting with a short reference recording and improving it over time only when the user explicitly opts in. Preserve the current Gemini TTS and all existing TTS fallbacks.

## Important technical distinction

IndicF5 is a reference-audio / zero-shot voice-cloning candidate: synthesis takes (1) text to speak, (2) reference audio, and (3) the exact transcript of that reference audio. A short sample can be enough to start a prototype, but output similarity and Bengali pronunciation must be measured; it is not a guarantee of a perfect clone.

“Learning continuously” must not mean silently training on every microphone recording. The first version should update a per-user reference profile or selected sample set with consent and quality checks. Model fine-tuning is a separate, heavier workflow that requires a clear opt-in, compute, versioning, rollback, and deletion strategy. A transcript by itself contains no voice identity information.

## Candidate model and hosting

- First candidate: AI4Bharat IndicF5; its upstream project lists Bengali support and uses reference audio plus its transcript.
- Candidate license reported upstream: MIT, but model-gating/usage terms must be reviewed and accepted by the operator before deployment. Verify all dependencies, pretrained weights, and dataset/model terms independently.
- Prototype inference must run outside the Cloudflare Worker, in a separate Python service. The Worker remains the authenticated routing/gateway layer; it should not load the model.
- Start with a free CPU Space or an operator-controlled local test only. Free CPU may be slow, sleep when idle, or be unavailable; do not promise production uptime or zero latency. Measure cold start, peak RAM, synthesis time, queue wait, and concurrency before public rollout.
- Do not download, commit, or store model weights, user voice recordings, transcripts, embeddings, or access tokens in the Git repository.

## User experience

1. Settings → Personal Voice → Create profile.
2. Explain what will be captured, where it will be processed, retention defaults, limitations, and how to delete it.
3. Capture a short clean reference sample and its transcript; allow review, replacement, and playback.
4. Require an explicit confirmation that the user owns the voice or has permission to use it.
5. Offer a preview sentence before enabling the profile.
6. Add a separate optional setting: “Use selected voice recordings to improve my voice profile.” It is OFF by default and must not be bundled with microphone/transcription consent.
7. The user can pause learning, review/delete saved samples, reset the profile, export where practical, or delete the complete voice profile.
8. Show a visible “AI-generated voice” indicator where appropriate and prohibit impersonation of another person without their explicit permission.

## Data and privacy rules

- Separate permissions: microphone/transcription consent, voice cloning consent, and consent to retain/reuse recordings for profile improvement.
- Default: do not retain raw audio after the requested transcription/synthesis/reference-processing job finishes, except for the initial reference sample the user explicitly saves.
- Do not use ordinary STT recordings, voice messages, calls, or uploaded audio for cloning merely because the audio was received. Reuse only when the user enabled the separate improvement consent and the recording meets the policy/quality checks.
- Store each user's profile, samples, embeddings, settings, and generated profile versions under a server-verified user/tenant ID. Never trust a user ID supplied only in the request body.
- Encrypt stored sensitive audio/profile material in transit and at rest. Keep raw audio and embeddings out of application logs, analytics, error reports, and public URLs.
- Define a short, documented retention policy. Deleting a profile must delete its reference audio, derived embeddings/features, queued training jobs, and profile versions where possible; revoke access and record a minimal non-sensitive deletion audit event. Backups must expire according to a documented schedule.
- Provide abuse limits, authentication, rate limits, file-size/duration limits, content-type validation, and request timeouts. A voice match is not a reliable identity or authentication factor by itself.

## Proposed service boundaries

- Frontend: consent/settings, record/upload, transcript correction, preview, profile status, pause/resume, delete/reset.
- Cloudflare Worker: authenticate the caller, enforce authorization and quotas, route requests, return provider/model/status metadata, and fall back to the existing provider when configured.
- Python inference service: load IndicF5 once per process, validate inputs, queue requests, synthesize audio, and return audio plus safe diagnostics. Require a strong service token; HTTPS only; never expose the service directly to arbitrary callers.
- Profile store: metadata, explicit consent timestamps/version, sample IDs, selected reference, profile version, status, retention/deletion status. Use an existing approved database only after verifying its schema and access controls.
- Job queue: optional profile-improvement jobs. Never block normal chat/TTS while updating a profile. Candidate samples are quarantined until validated; a new profile version is promoted only after a preview and quality checks.
- Existing Gemini TTS remains the default/fallback until the clone provider passes end-to-end tests. Do not change the default automatically.

## Proposed API contract (not implemented yet)

- GET /voice-profile — return the caller's profile status and consent settings, never raw audio.
- POST /voice-profile/reference — submit a short reference sample and exact transcript after authorization/consent.
- POST /voice-profile/preview — synthesize a bounded test sentence using the user's selected profile.
- PATCH /voice-profile/settings — change provider preference and the separate improvement-consent flag.
- POST /voice-profile/samples — optionally submit a candidate sample only when improvement consent is active.
- POST /voice-profile/pause — pause candidate collection/profile updates.
- DELETE /voice-profile — delete profile material and cancel queued jobs; do not implement a “permanently blocked” delete path for user-owned voice data.
- POST /tts — extend the existing provider router with an explicit personal_voice option only after the new provider is proven safe. Keep Gemini fallback and existing response contract.

All endpoints must enforce caller identity, ownership, payload limits, consent, CSRF/CORS policy as applicable, and non-leaking error messages.

## Versioned improvement workflow

1. User has enabled the separate improvement option.
2. A candidate recording is checked for duration, clipping, noise, transcript match, and likely single-speaker content.
3. Reject poor-quality, ambiguous, or non-consented samples; do not silently add them.
4. Present the candidate and its transcript to the user for confirmation when feasible.
5. Build a new reference/sample-set version without replacing the current working profile.
6. Run a fixed Bengali evaluation set (common words, numbers, names, punctuation, long sentences) and compare intelligibility, voice similarity, latency, and failure rate.
7. Promote only if checks pass; otherwise keep the previous version and explain the result.
8. Provide rollback and profile reset. Do not fine-tune the shared base model on private user recordings.

## Acceptance criteria before public activation

- Existing Gemini TTS behavior and response shape are unchanged when personal voice is disabled or unavailable.
- Multi-user isolation tests prove that one user cannot read, synthesize with, update, or delete another user's profile.
- Voice-cloning and profile-improvement consent are independent and default OFF.
- Deletion tests cover raw samples, derived profile material, queued jobs, and profile metadata.
- No secret, raw audio, transcript, or embedding appears in Git, browser bundles, URLs, or logs.
- Audio upload limits, authentication, rate limits, timeouts, fallback, and malformed-input tests pass.
- Bengali listening tests are completed with user-reviewed samples and clear known limitations.
- Free-tier cost/latency/concurrency and model license/dependency review are documented.
- Deploy first to a test environment, then use branch → CI → PR → approval → deployment → live smoke test. No direct main/live edits.

## Implementation phases

- Phase 0: approve this design and confirm current auth/database boundaries.
- Phase 1: isolated proof of concept with synthetic test inputs and one consenting test user; no production audio collection.
- Phase 2: authenticated single-user reference profile and preview, with deletion tests.
- Phase 3: multi-user isolation, UI settings, and provider-router integration behind a feature flag.
- Phase 4: opt-in candidate sample review and versioned profile updates.
- Phase 5: evaluate whether fine-tuning is needed at all. Only pursue it if reference-audio adaptation cannot meet quality goals and a lawful, affordable compute plan exists.

## Known limitations / open questions

- Zero-shot reference audio is adaptation at inference time, not automatic model training. Similarity may vary by recording quality, speaking style, and text.
- Free hosting is best-effort and cannot guarantee always-on low latency.
- Exact model, dependency, and hosted-inference terms must be verified before production.
- Authentication and a suitable persistent data store must be confirmed in the current repository before implementing user-owned profiles.
