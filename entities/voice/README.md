# Voice Entity

## Responsibility
Context-aware voice input and voice-journal processing.

## Brain boundary
The Voice Entity owns:
- speech transcript normalization;
- conservative smart punctuation;
- explicit, auditable contextual corrections;
- voice-session authorization.

It does not silently invent speech content.

## Audio boundary
Raw audio is handled by an external ASR adapter. The core engine accepts an ASR transcript or a transcript-bearing object and returns ASR_ADAPTER_REQUIRED for raw audio bytes.

## Pipeline
ASR transcript -> contextual correction -> smart punctuation -> visible result -> optional memory/audit.

## Safety
Listening requires explicit authorization. DELETE and destructive operations remain globally blocked.
