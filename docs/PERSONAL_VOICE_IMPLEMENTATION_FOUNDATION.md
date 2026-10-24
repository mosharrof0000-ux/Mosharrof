# Personal Voice Cloning — Implementation Foundation

Status: **prototype domain layer only; not connected to the live UI, Worker, or any audio store**.

## What this PR implements

- A provider-neutral service for per-user Bengali voice profile lifecycle.
- Separate consent flags for voice cloning, profile improvement, and future model training.
- Reference-sample enrollment with transcript and SHA-256 integrity metadata.
- Explicit approval for every additional sample, including audio that originated in speech-to-text.
- Candidate samples never become active automatically; activation requires a separate approval.
- Per-owner repository/audio-store interfaces, explicit profile deletion, and fail-closed behavior when a provider is unavailable.
- Unit tests using fake stores and a fake provider; no real audio or model download is needed.

## What this PR deliberately does not implement

- No HTTP endpoint, frontend control, authentication, persistent storage, or real IndicF5 provider.
- No automatic capture of microphone/STT audio.
- No training on every message, and no claim of an exact or continuously self-training voice clone.
- No change to Gemini TTS, current Worker routing, or deployment configuration.

## Next required integration gates

1. Implement the repository against the selected private database and the audio store against encrypted private object storage. Both must derive owner scope from a trusted authenticated session, never a client-supplied owner_id.
2. Review and pin the model revision, dependencies, license and model-card requirements; inspect any remote code before execution.
3. Implement an isolated Python provider service with authentication, upload/text limits, queue/timeouts, and no raw-audio logging.
4. Add authenticated Worker routes that derive identity from a verified session and call the provider. Preserve Gemini as the default and fallback.
5. Add UI for creating/reviewing/deleting a voice profile, separate consent toggles, preview, and explicit sample approval.
6. Run a real Bengali reference-audio evaluation, resource/latency tests, tenant-isolation tests, and deletion tests before enabling the feature flag.

## Privacy model

Voice data is sensitive biometric-like data. Keep it private and isolated per account; use HTTPS, encryption at rest, least-privilege access, no public object URLs, and bounded retention. Consent for speech transcription does not imply consent to voice cloning or training. Deleting a profile must remove that user's sample objects and profile metadata; backups need a documented expiration policy.

## First-user rollout

The project owner can be the first opt-in tester after the authenticated private storage and isolated inference service exist. Until then, this code is a tested foundation, not a working voice-cloning feature.
