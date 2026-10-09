# Smart Hybrid Text-to-Speech (TTS)

## Provider behavior

- **Auto (default):** regular chat tries Edge-TTS, then Sarvam. Song/poem/lyrics tries ElevenLabs first, then Edge-TTS, then Sarvam.
- **Edge-TTS:** primary provider for everyday answers. Voice selection is sent as `bn-BD-PradeepNeural` or `bn-BD-NabanitaNeural`.
- **ElevenLabs:** premium option. The API key remains a Cloudflare Worker secret; it is never shipped to the browser. Existing `ELEVENLABS_ALLOW_PAID=false` quota guard remains active.
- **Sarvam:** optional Bengali-capable server fallback when configured.
- **Browser Voice:** selected locally in the browser and used as the final fallback when server playback fails.

The existing message speaker buttons use this provider router. The provider selection and Edge voice preference are stored in the browser's local storage.

## Edge-TTS service requirement

Cloudflare Workers cannot directly run the Python `edge-tts` package, so this PR includes a small secured Python service in `services/edge-tts-api/`. Deploy that folder to a Python/Docker host (for example, create a Render Web Service with root directory `services/edge-tts-api` and Docker runtime). Some free hosting tiers sleep while idle, which adds startup delay. Set a strong random `EDGE_TTS_API_TOKEN` in the service's environment. Configure the Worker variable `EDGE_TTS_API_URL` to the deployed service's HTTPS `/tts` endpoint and the Worker secret `EDGE_TTS_API_TOKEN` to the exact same token. Optionally set `EDGE_TTS_VOICE`.

The service must accept a JSON POST such as:

```json
{
  "text": "বাংলা লেখা",
  "voice": "bn-BD-PradeepNeural",
  "language_code": "bn-BD",
  "pace": 1,
  "rate": "+0%",
  "output_format": "audio/mpeg"
}
```

It may return either raw audio bytes with an audio content type (preferably `audio/mpeg`) or JSON containing a base64-encoded `audio_data`, `audio_base64`, or `audio` field. The endpoint must use HTTPS in production. Do not put API keys in the Pages frontend.

## Cloudflare configuration

Set `EDGE_TTS_API_URL` as a Worker variable and `EDGE_TTS_API_TOKEN` as a Worker secret (never a browser variable). Set `EDGE_TTS_VOICE` if a server-side default is desired. Existing optional settings remain:

- `ELEVENLABS_API_KEY` (secret)
- `ELEVENLABS_VOICE_ID` (variable)
- `ELEVENLABS_MODEL` (variable)
- `ELEVENLABS_ALLOW_PAID` (variable; leave false to preserve the quota guard)
- `SARVAM_API_KEY` (secret, optional)

After deploying, check `https://mosharrof-screenshot-analysis.mosharrof0000.workers.dev/health`. It reports only whether each provider is configured, never any key value. `edge_tts_configured: true` means the URL is present; test a real `/tts` request to confirm that the external service responds correctly.

## Important limitations

- The Edge-TTS service source is included, but this PR cannot deploy it to an external hosting provider or create Cloudflare secrets. A real service URL and matching token must be configured before Edge-TTS will work; until then the app falls back safely.
- Premium ElevenLabs usage may consume quota or incur charges according to the account plan. Automatic premium selection is restricted to content detected as song/poem/lyrics; manual premium selection explicitly requests ElevenLabs first.
- Browser speech quality and available Bengali voices depend on the device/browser.
