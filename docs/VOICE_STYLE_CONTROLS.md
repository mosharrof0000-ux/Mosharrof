# MOSHARROF Voice Style Controls — Design Contract

## User experience goal
Let users independently choose **who speaks** (provider/voice identity) and
**how the text is delivered** (reading style and expressive controls). Changing
delivery must not silently replace the selected speaker or personal voice.

## Controls
- Speed: 0.5x–2.0x, with a default of 1.0x.
- Emotion: neutral, warm, joyful, sad, soothing, dramatic, confident.
- Emotion intensity: 0–100%.
- Pitch: -100% to +100% relative control where the provider supports it.
- Pause length: 0.5x–2.0x.
- Emphasis: 0–100%.
- Reading presets: natural conversation, poetry, article/essay, news, storytelling,
  educational/study, formal, and Quran recitation.

## Preset behavior
Presets are starting points, not locks. After choosing poetry, news, or another
mode, users can still adjust speed, emotion, pauses, and emphasis individually.
Always provide a reset-to-natural action. Persist preferences per user only after
authentication and allow users to change or delete them.

## Provider capability rules
- Each TTS provider declares supported controls; send only supported options.
- Prefer native SSML/prosody/style controls when officially supported.
- Where unavailable, use safe text segmentation, punctuation-aware pauses, and
  conservative prompt/style instructions only if that provider supports them.
- Do not claim an emotion, pitch, or style was applied if the provider ignored it.
- Keep the selected voice identity separate from delivery settings.
- Preserve the existing Gemini TTS route and fallback; introduce this behind an
  adapter and feature flag, not by replacing live behavior.
- Keep a visible “provider does not support this control” explanation where
  necessary. Playback speed may be adjustable in the player independently of
  generated audio if the client supports it.

## Bengali and Quran safeguards
Test Bengali punctuation, compound words, numerals, quotations, and long passages.
For Quran mode, use a dedicated, reviewed recitation provider/recording when
accurate tajwid is required. Generic emotional TTS must not be represented as
verified Quran recitation or tajwid.

## Accessibility and safety
Offer simple preset buttons plus an advanced panel; use Bengali labels, keyboard
and screen-reader accessible controls, and saved per-user preferences. Provide
an immediate stop/pause action. Never ingest microphone or conversation audio for
voice improvement unless the user separately opts in and approves each sample.

## Status
Design and settings validation only. This document does not mean the controls
are already present in the live UI or that every engine can synthesize every
style. The current PR is a foundation; full integration requires provider
capability mapping, UI, authenticated preference storage, tests, and end-to-end
verification.
