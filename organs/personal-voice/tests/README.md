# Personal Voice tests

- `profile.test.js` verifies explicit consent, profile normalization, owner isolation and serial non-reuse contracts.
- `provider-capabilities.test.js` verifies provider-specific control filtering and Gemini fallback.
- `worker/personal-voice.test.js` verifies owner authorization boundaries, safe health metadata and bounded sample/text limits.
- Read Aloud integration tests cover personal voice failure fallback to the existing Gemini TTS route.
