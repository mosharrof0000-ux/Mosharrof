# Message Audio Organ tests

- `read-aloud.test.js` covers message-text extraction, TTS request configuration, audio decoding, playback state, and browser fallback.
- `audio-download.test.js` covers generated-audio download creation and safe object-URL cleanup.
- `organ.test.mjs` covers user-message-only action injection, idempotence, and observer cleanup.
