# Message Audio Organ

Owns the read-aloud and generated-audio download controls for user-sent chat messages.

- Observes the existing message action groups without changing the frozen legacy HTML shell.
- Uses the existing MOSHARROF TTS Worker endpoint and the same provider/voice preference keys.
- Reuses browser speech synthesis only as a fallback when server TTS is unavailable or browser TTS is explicitly selected.
- Adds a download control only when actual server-generated audio bytes are available.
- Does not store message text or audio in persistent storage.

The organ is loaded through the existing UI-organ composition root and owns its feature modules and component tests.
