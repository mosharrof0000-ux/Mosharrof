# Personal Voice System

The personal voice feature lives inside the existing **Read Aloud** action. A long press on the existing speaker action opens its compact menu; an ordinary tap keeps the current read-aloud behavior. No extra toolbar button or separate settings page is introduced.

## Implemented in this branch

- Owner-private profile API under the existing Cloudflare Worker at `/personal-voice/*`.
- Supabase Auth user verification plus the existing `asm_is_registered_owner` owner gate. Database and Storage access use the user's JWT and RLS; no service-role key is shipped or required by the Worker.
- Supabase Postgres schema with owner-scoped profiles, separate consent flags, profile defaults, saved catalog voices, and one global non-cycling serial sequence shared across cloned profiles and saved catalog voices.
- Private Supabase Storage bucket. The Worker encrypts uploaded audio with AES-256-GCM before upload and decrypts only for the private inference request. Raw samples are not logged.
- Multiple reusable profiles, rename, default profile, per-message voice selection, deletion, and separate consent for voice use, sample retention, and model training (training defaults off).
- Searchable provider catalog, language/style filters, provider availability, explicit unknown-license status, sample preview through the existing TTS Worker, and saved catalog voices with permanent serials.
- IndicF5 inference proxy contract using the existing isolated personal-voice API prototype. A failed personal-voice request falls back to the existing Gemini TTS route.
- Provider controls are capability-filtered. Speed is shown only for Edge/Sarvam; unsupported pitch, emotion, intensity, pause, and emphasis controls are not displayed.
- Tests for owner gating, safe health metadata, limits, personal-voice-to-Gemini fallback, and provider capability filtering.

## Routes

- `GET /personal-voice/health`: safe readiness flags only.
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

The inference service separately requires `HF_TOKEN`, a reviewed exact `INDICF5_MODEL_REVISION` commit SHA, and the model's accepted access terms. The Worker verifies the user's Supabase JWT and `asm_is_registered_owner` RPC before any profile/catalog operation. The user's browser must already have a valid Supabase Owner Login session; the menu does not create a second login system.

The current project and service have not been activated or deployed by this PR. The Supabase migration is source-only until explicitly applied to an active project; the Worker secrets and inference endpoint are not configured here. The health endpoint keeps profile setup unavailable until the required authentication and encryption configuration exists. Do not upload a sample until the live health/readiness checks pass.

## Consent, retention, and safety

- Voice use and sample storage require separate explicit consent. Model-training consent is separate and defaults off.
- Only the registered owner can read or change their profiles. Storage object paths are owner-prefixed and protected by Storage RLS.
- Sample files are encrypted before Storage upload using AES-256-GCM. The encryption key is server-only.
- Deleting a profile removes its private sample and database row; the global serial sequence is not reset, so deleted serials are never reused.
- Revoking voice-use consent disables the profile. Revoking sample-storage consent deletes the stored sample.
- Catalog entries currently have `license_status=unknown` and `consent_status=required`; they are not represented as licensed celebrity/real-person clones. Only provider voices already present in the existing TTS implementation are seeded.
- IndicF5 is reference-audio synthesis, not a promise of exact voice identity or fine-tuned model weights. No Quran recitation or tajwid capability is claimed.

## Still required for production completion

- Apply the SQL migration to the active Supabase project and verify RLS/Storage policies with real owner and non-owner sessions.
- Configure Worker secrets and verify `/personal-voice/health`.
- Deploy the pinned IndicF5 service privately after model/license/code review; test Bengali quality and quotas.
- Run CI, browser verification, and a real Android-device test. Confirm that Gemini's existing request path and all current TTS providers still work.
- Verify sample upload, encrypted object bytes, synthesis, fallback, consent revocation, hard deletion, and permanent serial non-reuse end-to-end.

This PR contains the implementation source and tests, but it is not live until the infrastructure steps above are completed and evidenced. It must remain a Draft until then.
