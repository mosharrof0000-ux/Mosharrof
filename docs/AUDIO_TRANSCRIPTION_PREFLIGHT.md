# Audio transcription preflight

This manual workflow checks the deployed Worker without deploying code or consuming Gemini transcription quota.

It verifies:
1. `/health` reports the transcription route and Gemini configuration.
2. Browser CORS preflight succeeds for the GitHub Pages origin.
3. `POST /transcribe-audio` reaches the route and returns the expected validation error for an intentionally unsupported MIME type.

This is only a route/CORS preflight. It does **not** prove that a real microphone recording is accepted or transcribed. A separate end-to-end test with a short real audio sample is still required before declaring microphone transcription fixed.

Run it from **GitHub → Actions → Audio Transcription Preflight → Run workflow**. It is manual-only, read-only against the repository, uses no GitHub/Cloudflare secrets, and does not deploy anything.
