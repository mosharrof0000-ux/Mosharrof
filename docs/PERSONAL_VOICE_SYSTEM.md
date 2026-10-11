# MOSHARROF Personal Voice System — Foundation v1

## Goal

Allow each authenticated user to create a personal Bengali voice profile from a
short, clear reference recording, use it for TTS, and optionally improve it with
additional user-selected recordings over time. Keep the existing Gemini TTS
provider intact as the default and fallback.

## What this foundation provides

- A tested Python domain contract for per-user profile ownership.
- Independent consent flags for cloning, sample-based improvement, and future
  model training. All flags default to off.
- Sample registration only after separate opt-in, explicit user approval, and
  a non-empty transcript.
- User-approved voice-version activation.
- Revocation methods that return private audio references for the storage adapter
  to permanently delete.

## Deliberate boundaries

This is a foundation, not a deployed cloning service. It does not yet store
audio, expose API endpoints, train a model, or alter the live TTS route. It does
not claim to identify a speaker from an arbitrary recording. Authentication,
private object storage, a model host, and end-to-end browser integration must be
implemented and tested before any profile can be used by real users.

The calling API must derive the authenticated owner ID from a verified session
or signed identity token. Never trust a user ID sent freely in JSON. Every
object read, write, playback, sample, and deletion must enforce owner isolation.

## Consent and continuous improvement

Microphone recordings and transcriptions must not be added automatically just
because they exist. The user must separately enable sample-based improvement
and approve each sample. A verified transcript is required to reduce model
drift. Raw conversation audio should be excluded by default.

New samples should first be evaluated for noise, clipping, transcript alignment,
language, and similarity to the current voice. Keep accepted samples and model
versions separate. Never replace the active voice model without explicit user
approval and a successful quality check.

A reference audio used for inference does not itself train or permanently update
a model. Actual model fine-tuning is a distinct, optional future capability.

## Proposed implementation stages

1. Identity and storage: establish verified user identity and private,
   owner-scoped audio storage with retention and deletion guarantees.
2. Model proof: review the current IndicF5 model card, license, attribution
   requirements, inference dependencies, and CPU/RAM needs. Run a small prototype.
3. Inference adapter: add an isolated Python service with authentication,
   per-user rate limits, request-size limits, timeouts, and no public audio URLs.
4. UI and provider routing: add a user-controlled My Voice profile and consent
   controls. Add a personal_voice provider without changing Gemini. If unavailable,
   time out, or over quota, fall back to the existing provider.
5. Quality-gated improvement: add user-approved sample review and versioning.
   Do not claim continuous learning until actual model updates exist and are
   measurable.
6. Release: automated tests, security review, PR approval, staged deployment,
   live smoke tests, and a verified deletion test.

## Acceptance criteria before real-user release

- User A cannot list, play, change, or delete User B's profile or samples.
- Consent is granular, revocable, and auditable.
- No audio is stored or used for improvement without explicit opt-in.
- Revocation deletes stored objects and derived artifacts, not just metadata.
- Gemini TTS continues working when the personal voice service is offline.
- Bengali pronunciation and similarity are tested with held-out sentences.
- Free-host limits, cold starts, sleep behavior, and realistic request capacity
  are measured; unlimited free use is not promised.
- Model license and use restrictions are approved before deployment.

## Cost and hosting note

Cloudflare Workers should orchestrate requests, not host the large model itself.
A separate Python inference host is required. A free CPU host can be used for a
proof of concept but may sleep, run slowly, or enforce quotas. Do not upload
voice samples to a public repository or public demo.
