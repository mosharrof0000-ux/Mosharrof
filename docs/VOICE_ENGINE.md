# Mosharrof Voice Engine

## Pipeline

`Authorized audio -> ASR provider -> contextual normalization -> smart punctuation -> journal/audit`

### Smart punctuation
`apply_smart_punctuation()` normalizes whitespace and punctuation and conservatively infers a terminal mark. Question cues can produce `?`.

### Contextual correction
`correct_contextual_grammar()` applies only high-confidence transcript corrections. Ambiguous words are preserved rather than guessed.

### Phonetic sanitization
`sanitize_phonetic_speech()` requires explicit recording authorization and an attached transcription provider. Raw audio is never silently invented or decoded by this module.

This keeps the entity model-agnostic: the ASR/LLM provider can change without changing the Voice Entity identity or permission boundary.
