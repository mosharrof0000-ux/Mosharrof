# Voice Style Studio — product and implementation contract

Status: design specification; not a live UI or working TTS feature yet.

## Goal

Let each authenticated user control *how speech is delivered* independently from *which voice identity* is used. Preserve the existing Gemini TTS path and defaults. Personal voice cloning is a separate, consent-gated provider and must not be implied to work until a compatible model is integrated and tested.

## User controls

- **Speed:** slower / normal / faster, plus a numeric rate when the selected engine supports it.
- **Emotion / delivery:** calm, warm, cheerful, serious, gentle, excited, and neutral. Expose intensity only when the engine supports a meaningful control.
- **Reading presets:** poem/recitation, article, news, story, lecture/educational, conversational, formal announcement, and accessibility-friendly clear reading.
- **Prosody:** pause length, sentence pacing, emphasis, and pronunciation/clarity, only where supported.
- **Voice identity:** current Gemini voice, other supported provider voices, and the user's own approved personal voice when available.
- **Saved presets:** users can save, rename, select, and reset their own combinations.

## Interaction expectations

1. Put the controls in a compact “কণ্ঠ ও পড়ার ধরন” / “Voice Style” panel with a preview action.
2. Offer quick actions such as “গতি বাড়াও”, “গতি কমাও”, “আবেগ বাড়াও”, “আবেগ কমাও”, “স্বাভাবিক করো”, and named reading styles.
3. Provide a visible reset-to-default action and show which settings are active.
4. Persist preferences per authenticated user only after explicit save; do not mix one user's settings with another's.
5. Style changes must not silently change the voice identity. Voice and delivery style remain independent selections.
6. Existing chat text, send flow, voice recording, Gemini TTS defaults, and fallback behavior must remain intact.

## Capability-aware engine adapter

Use a normalized style profile, then map only supported fields to each engine. Suggested profile fields:

- `voice_id`
- `rate` (normalized range; adapter maps to provider range)
- `delivery_preset`
- `emotion` and `emotion_intensity`
- `pause_scale`
- `emphasis`
- `pronunciation_mode`

Every provider declares its supported capabilities. If a provider cannot control emotion, emphasis, or a requested preset, the UI must say so and either apply a documented best-effort text/prosody transformation or leave that setting unavailable. Never claim an unsupported setting was applied. Do not degrade or replace the existing Gemini engine to simulate unsupported features.

A reading preset may shape punctuation, paragraph breaks, and pause hints before synthesis, but must preserve the user's original text and offer a way to disable transformations. Do not add invented words to Qur'anic or other exact-source text.

## Privacy and consent

- Personal voice creation and selected-sample improvement are separate opt-ins.
- Do not automatically enroll microphone recordings or all chat audio as training data.
- Only use a user's own voice with explicit permission; require authenticated owner checks for profile, sample, preset, and synthesis operations.
- Revocation must disable further personal-voice use and trigger deletion of stored audio/derived artifacts through a verified storage adapter.
- Do not put audio, transcripts, tokens, or personal identifiers in logs.

## Acceptance criteria

- Existing Gemini TTS behavior is unchanged when no style settings are selected.
- Rate up/down/reset is tested for every engine that advertises rate support.
- Presets are mapped per engine and unsupported controls are visibly disabled or explained.
- Voice identity and reading style can be changed independently.
- Saved preferences are isolated by authenticated user.
- Tests cover reset, unsupported capabilities, provider fallback, and persistence.
- Mobile layout is usable, keyboard/screen-reader accessible, and does not obscure chat content.
- End-to-end browser/device tests verify audible output before calling the feature complete.

## Rollout

Implement in stages: (1) provider capability contract and tests, (2) settings model and persistence, (3) compact UI and preview, (4) adapter mapping for current Gemini TTS, (5) optional personal-voice adapter only after model/license/hosting/authentication reviews. Keep changes on a feature branch and do not merge or deploy without all checks and review.
