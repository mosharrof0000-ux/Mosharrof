# Manual Provider Controls

- Press and hold the compact Auto/model pill (or the live response-route label) to choose Auto or a specific chat provider/model.
- Auto keeps the existing Gemini → Cloudflare Workers AI → Groq → OpenRouter failover. Manual chat selection requests only the selected provider/model; it does not silently switch providers.
- Press and hold any read-aloud control to choose Auto or a specific TTS provider. Auto stays free-first; manual selection requests the chosen provider only.
- Press and hold the recording microphone to choose Auto transcription fallback or a specific supported Gemini transcription model.
- Preferences are stored locally on the device. The menus use compact semantic colors: green for Auto/ready, blue for selection, yellow for checking/pending, and red only for restricted/paid or error meaning. Background tints remain subtle.

## Manual chat model allowlist

- The manual chat menu intentionally exposes only Auto, Gemini 3.6 Flash, and the two Cloudflare Workers AI models documented as the default fallback pair.
- Unverified Gemini model IDs and optional Groq/OpenRouter choices are hidden from manual selection until their availability can be confirmed. This is a UI allowlist, not a claim that those services are permanently broken.
- Auto routing still tries Gemini, Cloudflare Workers AI, Groq, and OpenRouter in server-side order when the relevant provider is configured. Hiding a manual option does not disable that automatic fallback.
- A model should be restored to the manual menu only after a real provider request succeeds and the result is captured in CI/health evidence; configuration presence alone is not a successful inference test.

See [Provider Availability and Verification](MANUAL_PROVIDER_AVAILABILITY.md) for credential, quota, and live-inference rules.
