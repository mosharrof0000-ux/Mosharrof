# Progressive TTS + Auto Download

## Behavior
1. Speak button only at start (no download).
2. Text is split into sentence chunks and played progressively as each chunk is ready.
3. When the full audio is complete, a download button appears automatically to the right of the speak button.
4. Download button uses the same visual family as speak/message-action shortcuts.
5. Browser Voice fallback has no download (no audio file available).
6. Stopping mid-play does not show download (only full completion does).

## Fix note
Syntax in `speechTextFromMarkdown` was corrected to `if(clean)return clean;`.
