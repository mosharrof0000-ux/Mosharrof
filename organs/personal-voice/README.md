# Personal Voice System

The personal voice feature lives inside the existing **Read Aloud** action. A long press on the existing speaker action opens its compact menu; an ordinary tap keeps the current read-aloud behavior. No extra toolbar button or separate settings page is introduced.

## Implemented in this branch

- Owner-private profile API under the existing Cloudflare Worker at `/personal-voice/*`.
- Owner Login is available inside the same Read Aloud menu. The Worker forwards credentials to Supabase Auth over HTTPS, does not log or persist passwords, verifies the resulting user JWT, and applies the existing `asm_is_registered_owner` gate. Database and Storage access use the user JWT and RLS; no service-role key is shipped or required.
- Supabase Postgres schema with owner-scoped profiles, separate consent flags, profile defaults, saved catalog voices, and one global non-cycling serial sequence shared across cloned profiles and saved catalog voices.
- Private Supabase Storage bucket. The Worker encrypts uploaded audio and its reference transcript with AES-256-GCM before upload/storage, then decrypts only inside the private inference request. Raw samples and plaintext transcripts are not logged or stored in the profile row.
- Multiple reusable profiles, rename, default profile, per-message voice selection, profile test playback, deletion, and separate consent for voice use, sample retention, and model training (training defaults off).
- Searchable provider catalog, language/style filters, provider availability separated from license/consent approval, preview only after all gates pass, and saved catalog voices with permanent serials. Selecting a saved catalog voice or changing provider/voice controls applies to the current message rather than silently changing every message.
- Isolated IndicF5 inference service source with pinned upstream code, exact model revision requirement, bearer authentication, audio/text/duration limits and temporary-file cleanup. The Worker uses a dedicated provider adapter; a failed personal-voice request falls back to the existing Gemini TTS route.
- Per-owner synthesis quota of 10 requests per 60-second quota window, enforced atomically by a Supabase RPC.
- Provider controls are capability-filtered. Speed is shown only for Edge/Sarvam; unsupported pitch, emotion, intensity, pause, and emphasis controls are not displayed.
- Tests for owner gating, safe health metadata, limits, personal-voice-to-Gemini fallback, and provider capability filtering.

## Routes

- `GET /personal-voice/health`: safe configuration flags only.
- `GET /personal-voice/readiness`: authenticated checks for migration, owner-private Storage, encryption and inference before enabling sample enrollment.
- `POST /personal-voice/auth/login` and `/auth/refresh`: server-mediated Supabase Auth session and refresh.
- `GET|POST /personal-voice/profiles`: list/create owner profiles.
- `PATCH|DELETE /personal-voice/profiles/:id`: rename/revoke/delete.
- `POST /personal-voice/profiles/:id/sample`: explicit-consent sample upload.
- `POST /personal-voice/profiles/:id/synthesize`: personal voice synthesis.
- `PUT /personal-voice/preferences/default`: set the default profile.
- `GET /personal-voice/catalog`: search enabled catalog entries.
- `GET|POST /personal-voice/catalog/saved` and `DELETE /personal-voice/catalog/saved/:id`: saved catalog library.

## Required server configuration

Set these only as server-side Worker variables/secrets; never in Pages/browser code:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (public application key; user identity still requires a valid session JWT)
- `PERSONAL_VOICE_ENCRYPTION_KEY`: base64-encoded 32-byte AES-256 key
- `PERSONAL_VOICE_API_URL`: private HTTPS URL for the isolated IndicF5 API
- `PERSONAL_VOICE_API_TOKEN`: strong server-to-server bearer token

The included inference service separately requires `HF_TOKEN`, a reviewed exact `INDICF5_MODEL_REVISION` commit SHA, and the model's accepted access terms. The Worker verifies the user's Supabase JWT and `asm_is_registered_owner` RPC before any profile/catalog operation. The email/password form is embedded inside the existing Read Aloud menu and uses the same Supabase Auth project and owner-registry RPC; it does not create a second identity store. A user must be registered in the Owner Registry before profile/catalog APIs are accessible.

The current project and service have not been activated or deployed by this PR. The Supabase migration is source-only until explicitly applied to an active project; the Worker secrets and inference endpoint are not configured here. The Read Aloud menu keeps profile enrollment unavailable until the authenticated readiness endpoint confirms the database migration, private Storage bucket, encryption key, and a successful authenticated model warmup (`/ready`). Do not upload a sample until the live health/readiness checks pass.

## Consent, retention, and safety

- Voice use and sample storage require separate explicit consent. Model-training consent is separate and defaults off.
- Only the registered owner can read or change their profiles. Storage object paths are owner-prefixed and protected by Storage RLS.
- Sample files are encrypted before Storage upload using AES-256-GCM. The encryption key is server-only.
- Deleting a profile removes its private sample and database row; the global serial sequence is not reset, so deleted serials are never reused.
- Revoking voice-use consent disables the profile. Revoking sample-storage consent deletes the stored sample.
- Catalog entries currently have `license_status=unknown` and `consent_status=required`; they are not represented as licensed celebrity/real-person clones. Only provider voices already present in the existing TTS implementation are seeded.
- IndicF5 is reference-audio synthesis, not a promise of exact voice identity or fine-tuned model weights. No Quran recitation or tajwid capability is claimed.
- The upstream IndicF5 model card declares MIT and lists Bengali support, but an open upstream issue asks for clarification about the original F5-TTS pretrained weights, IndicVoices-R dataset rights, and a missing repository LICENSE file. Keep `PERSONAL_VOICE_MODEL_REVIEWED=false` until those questions and the exact pinned code/model revision are independently cleared; do not treat the model-card label alone as a complete commercial clearance.

## Still required for production completion

- Apply the SQL migration to the active Supabase project and verify RLS/Storage policies with real owner and non-owner sessions.
- Configure Worker secrets and verify `/personal-voice/health`.
- Deploy the pinned IndicF5 service privately after model/license/code review; test Bengali quality and quotas.
- Run CI, browser verification, and a real Android-device test. Confirm that Gemini's existing request path and all current TTS providers still work.
- Complete a model license/code review and real Bengali similarity/latency tests; the prototype does not promise exact identity and does not fine-tune model weights.
- Verify sample upload, encrypted object bytes, synthesis, fallback, consent revocation, hard deletion, and permanent serial non-reuse end-to-end.

This PR contains the implementation source and tests, but it is not live until the infrastructure steps above are completed and evidenced. It must remain a Draft until then.
