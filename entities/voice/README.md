# Voice Entity

Owns authorized voice input, transcript normalization and voice-journal processing.

Smart punctuation and conservative contextual normalization are available in `src/core/voice_engine.py`. Raw-audio processing remains an adapter boundary until an authorized speech-to-text model is attached.

Permission profile: `voice`.
