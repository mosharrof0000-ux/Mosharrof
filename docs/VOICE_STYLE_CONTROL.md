# Voice Style Control — Design Specification

Status: design specification only; no live UI or TTS behavior is claimed to be implemented.

## Goal
Let each user control how text is spoken independently from the selected voice identity. Preserve the existing Gemini TTS path and defaults. A personal voice is an optional provider, not a replacement for Gemini.

## User controls
- Speaking speed: slower / normal / faster, with a slider and reset.
- Expressiveness / emotion: less expressive to more expressive, with a neutral default.
- Pause density: fewer pauses / natural / more pauses.
- Pronunciation clarity: normal / careful, where the provider supports it.
- Pitch: optional and provider-gated; do not promise support from every voice engine.
- Reading mode presets:
  - Conversation: natural, relaxed, moderate pace.
  - Article: clear, steady, structured pauses.
  - Poetry: expressive pacing, line-aware pauses, gentle emphasis.
  - Storytelling: dynamic pace and emotion, longer scene pauses.
  - News / formal: restrained emotion, crisp pronunciation, steady pace.
  - Study / explanation: slower pace, extra pauses around headings and key points.
  - Quran / sensitive text: respectful, restrained delivery; never invent tajwid or religious correctness. Use a dedicated validated recitation engine if exact recitation is requested.
  - Custom: user-adjustable settings.
- Quick actions: “গতি বাড়াও”, “গতি কমাও”, “আবেগ বাড়াও”, “আবেগ কমাও”, “কবিতার মতো পড়ো”, “আর্টিকেলের মতো পড়ো”, “স্বাভাবিকভাবে পড়ো”, and “আগের সেটিংসে ফেরাও”.
- Preview button and per-user saved defaults; controls should be keyboard/screen-reader accessible.

## Provider behavior
- Normalize settings in a provider-neutral VoiceStyleSettings object.
- Each TTS provider declares supported controls and ranges. Apply only controls it actually supports.
- If a provider cannot express emotion, pitch, or pause settings directly, use safe text segmentation/SSML only where supported; do not silently claim that the requested effect was applied.
- Keep voice identity and delivery style separate: a personal voice changes speaker identity; a style preset controls delivery. The resulting similarity depends on the selected model/provider and must be tested.
- Keep Gemini TTS behavior unchanged when style controls are unset. If style application fails, fall back to the current Gemini behavior and show a truthful status.
- Never change a user's voice profile or train a model just because they adjust playback style.

## Suggested data contract
```json
{
  "provider": "gemini",
  "voice_profile_id": null,
  "preset": "conversation",
  "speed": 1.0,
  "expressiveness": 0.5,
  "pause_density": 0.5,
  "pronunciation_mode": "normal",
  "pitch": null
}
```
Values above are illustrative defaults, not a provider guarantee. Validate and clamp ranges server-side. Store preferences per authenticated user and enforce owner checks; never trust a user-supplied owner ID.

## Privacy and safety
- Voice cloning and sample-based improvement remain separate, explicit opt-ins.
- Reading style controls do not grant consent to record, retain, or train on microphone audio.
- Keep voice samples private; provide revocation and deletion of audio and derived artifacts.
- Rate-limit synthesis and uploads, limit duration/size, and avoid logging audio, transcripts, tokens, or raw personal data.

## Acceptance criteria before release
1. Unset controls preserve current Gemini TTS behavior.
2. Speed up/down and emotion up/down work through both UI controls and Bengali quick commands where supported.
3. Poetry, article, story, formal/news, study, and custom presets have documented provider mappings and tests.
4. Provider capability limitations are shown honestly; unsupported controls are disabled or marked unavailable.
5. Personal voice can be selected without losing style controls where the chosen engine supports them.
6. Per-user preferences are isolated; user A cannot read or change user B's settings.
7. No live deployment or model training occurs from this design document alone.