# Personal Voice tests

- `profile.test.js` verifies explicit consent, profile normalization, owner isolation and serial non-reuse contracts.
- `provider-capabilities.test.js` verifies provider-specific control filtering and Gemini fallback.
- `worker/personal-voice*.test.js` verifies Worker routing, owner authorization, safe health metadata, encryption/decryption integrity, Storage migration safeguards and bounded sample/text limits.
- `services/personal-voice-api/test_main.py` verifies auth-before-inference, bounded audio, WAV response and temporary-file cleanup.
- Read Aloud integration tests cover personal voice failure fallback to the existing Gemini TTS route.
