# Personal Voice Cloning System — Architecture and Safe Rollout

Status: **design proposal; not deployed**

## Goal

Let every signed-in Mosharrof user create and use a personal Bengali voice profile. Start with a short reference recording, generate read-aloud audio in a similar voice, and optionally improve the profile over time with new samples the user explicitly approves. Preserve the existing Gemini TTS provider and fallback path.

This system is voice *similarity* using a reference prompt, not a guarantee of a perfect or exact clone. A reference-conditioned model such as IndicF5 does not automatically train its model weights on every recording. Treat profile adaptation and model training as separate concepts.

## Current repository findings

- The current Worker already routes `/tts` requests across configured providers and has a Gemini path. The new provider must be optional and must not change existing defaults until tested.
- The current `/transcribe-audio` route is used for speech-to-text. Transcription audio must not silently become voice-training data.
- `src/core/voice_engine.py` currently describes authorized voice input/transcript processing, not a production speaker-embedding or voice-cloning service.
- `entities/voice/README.md` says destructive deletion is blocked. A user's right to remove their own voice profile must be implemented as a narrowly scoped privacy operation; it must not permit deletion of project code, other users' data, or audit/security records.
- The repository's Cloudflare Worker is a routing/API boundary, not a place to load a 0.4B-parameter PyTorch model.

## Candidate model and licensing gate

Candidate: [AI4Bharat/IndicF5](https://huggingface.co/ai4bharat/IndicF5).

The model card lists Bengali support, MIT as the model license, and a condition that voices may only be cloned with explicit permission. It accepts target text, a reference audio clip, and the transcript of that clip. The model card currently recommends checking Indic-Speak for improved general TTS, but that does not establish that Indic-Speak supports the same reference-voice cloning workflow.

Before deployment:
1. Pin a reviewed model revision and dependencies; inspect `trust_remote_code=True` code before execution.
2. Confirm model-weight, code, dependency, dataset and hosting terms separately.
3. Keep the provider behind a feature flag until Bengali similarity, pronunciation, latency and memory tests pass.
4. Never describe a third-party voice or an untested model as the user's exact voice.

## User experience

1. **Personal Voice** setting is off by default.
2. Explain what is processed, where audio is sent, how long the reference is retained, and how to delete it.
3. User records a short, clean Bengali prompt (prototype target: 10–20 seconds; validate actual minimum during tests) and confirms the transcript.
4. Show a generated preview. Save the profile only after the user accepts it.
5. Read-aloud offers `My Voice`, `Gemini`, and `Auto/fallback`; existing Gemini behavior remains available.
6. Add controls for pause/resume adaptation, replace sample, export where feasible, delete profile, and disable voice cloning.

## Safe incremental adaptation

"Learn continuously" must mean controlled updates to a user's *reference profile*, not hidden training on all conversation audio.

- Default: do not retain microphone recordings after transcription.
- Optional setting: "Suggest eligible recordings to improve my voice profile" is separately opt-in and initially off.
- Even with that setting on, never add a sample automatically without a per-sample confirmation (or an equally clear, revocable consent mechanism explicitly designed and reviewed for this purpose).
- Only consider clean speech confidently attributed to that user. Exclude mixed speakers, calls, background media, third-party voices, sensitive conversations, and recordings with uncertain consent.
- Check audio quality and transcript alignment. Keep a versioned profile so the user can roll back.
- Do not update shared model weights from an individual's audio. Do not mix profiles across users.
- If the sample is poor, mismatched, or does not improve the voice, reject it and preserve the previous profile.

## Data isolation and lifecycle

- Require authenticated user identity for profile create/read/update/delete; never trust a user ID supplied by the browser alone.
- Store each profile under a server-derived tenant/user key with strict authorization checks.
- Encrypt reference audio at rest and in transit; keep any encryption keys and provider tokens in server secrets, never in browser code.
- Minimize retention. Keep only the current reference sample(s) needed for synthesis, with explicit retention controls. Delete superseded samples promptly.
- Deleting a profile must delete the reference audio, transcript, derived voice data, cache entries and queued copies; invalidate signed URLs and remove backups under a documented bounded backup-retention policy.
- Keep audit events minimal: actor, action, timestamp, result and profile ID; never log audio, transcripts, tokens or raw voice features.
- Add rate limits, maximum duration/size, MIME and decode checks, abuse reporting, and protections against cross-user IDOR.
- Require the user to attest that the voice is their own or that they have explicit permission. Provide a process to report/remove impersonation.
- Label generated audio as AI-generated where practical; do not enable impersonation of another person without their permission.

## Proposed architecture

```text
Web/PWA
  ├─ existing Gemini TTS (unchanged)
  ├─ existing /transcribe-audio (transcription only by default)
  └─ authenticated Personal Voice endpoints
       ├─ consent + profile settings
       ├─ enrollment / preview
       ├─ optional sample-review queue
       ├─ profile versioning + deletion
       └─ provider adapter
            └─ isolated Python inference service (IndicF5 candidate)
```

The Cloudflare Worker should authenticate/authorize, validate request size and content, enforce per-user rate limits, call the isolated inference service, and return audio. Model inference should run in a separate Python service because the Worker has strict CPU/memory constraints. A free CPU host may sleep, have cold starts, or be too slow for acceptable interactive use; therefore free hosting is a prototype, not an always-on SLA.

## Suggested API contract (not implemented yet)

- `GET /voice/profile` — current user's profile status and consent flags; never return another user's profile.
- `POST /voice/enroll` — short reference audio + confirmed transcript + explicit consent; returns preview/status.
- `POST /voice/preview` — synthesize a short test sentence from the current user's profile.
- `POST /voice/samples/review` — submit a candidate sample for explicit review; do not auto-merge it.
- `POST /voice/profile/activate` — activate a user-approved profile version.
- `DELETE /voice/profile` — delete only the authenticated user's personal voice data and associated caches.
- `POST /tts` — accept a provider choice such as `personal_voice`, but preserve the existing Gemini path and current defaults.

All endpoints need authentication, authorization, schema validation, abuse/rate controls, and tests. Do not deploy unauthenticated profile endpoints.

## Rollout phases

### Phase 0 — Design and privacy gate
- Review model/license terms and dependency supply chain.
- Define user identity, consent, storage and deletion semantics.
- No audio storage or live behavior change in this phase.

### Phase 1 — Isolated local/CI prototype
- Add a separate Python service adapter and pinned dependency set.
- Test only with a developer-owned, explicitly consented Bengali sample.
- Verify audio format, transcript alignment, latency, memory and voice similarity.
- Do not connect the public app or store end-user samples.

### Phase 2 — Authenticated private beta
- Add consent UI and profile endpoints with per-user isolation.
- Keep Gemini as default and expose personal voice only to enrolled users.
- Add tests for unauthorized access, cross-user isolation, deletion and provider failure.
- Limit beta access; do not enable automatic sample collection.

### Phase 3 — Opt-in profile improvement
- Add a review queue for new samples.
- Compare candidate preview with the active profile; require user approval before activation.
- Provide rollback and complete deletion.
- Add no shared-weight training and no silent learning.

### Phase 4 — Availability decision
- Measure free-host cold starts, throughput and memory under real load.
- If free CPU cannot meet acceptable latency, clearly mark personal voice as best-effort and keep Gemini fallback. Do not promise always-on free service.
- Only enable by default after security, privacy, license, accessibility and reliability review.

## Acceptance tests

- Gemini TTS behavior and existing routes are unchanged when the feature flag is off.
- A short user-approved Bengali reference sample can produce a preview with intelligible Bengali speech.
- No recording is retained or reused for cloning without the required opt-in.
- No user can read, synthesize from, update or delete another user's profile.
- User can pause adaptation, reject a candidate, roll back a profile version and delete all personal voice data.
- Failed inference, sleeping host, timeout, invalid audio and quota errors fall back to existing TTS without breaking chat.
- Logs contain no audio bytes, transcript text, API secrets or raw voice data.
- Public deployment remains blocked until the model terms, auth layer, storage, deletion, CI and live smoke tests pass.

## Current status

- Architecture: documented in this proposal.
- IndicF5: candidate only; not integrated.
- Personal voice profile storage/auth endpoints: not implemented.
- Continuous adaptation: not implemented; proposed as explicit, per-sample review.
- Live app: unchanged.
