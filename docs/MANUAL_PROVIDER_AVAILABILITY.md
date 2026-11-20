# Provider Availability and Verification

## Provider availability

A menu option does not guarantee the provider's credentials/quota are configured. A selected provider that is unavailable reports its failure rather than silently pretending a different provider was used. ElevenLabs remains subject to the Worker paid-provider policy. Transcription currently supports Gemini model selection and its existing model fallback; it does not pretend Cloudflare or Microsoft transcription endpoints exist when they are not implemented in the Worker.
