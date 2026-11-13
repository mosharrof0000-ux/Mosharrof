# Manual Provider Controls

- Press and hold the compact Auto/model pill (or the live response-route label) to choose Auto or a specific chat provider/model.
- Auto keeps the existing Gemini → Cloudflare Workers AI → Groq → OpenRouter failover. Manual chat selection requests only the selected provider/model; it does not silently switch providers.
- Press and hold any read-aloud control to choose Auto or a specific TTS provider. Auto stays free-first; manual selection requests the chosen provider only.
- Press and hold the recording microphone to choose Auto transcription fallback or a specific supported Gemini transcription model.
- Preferences are stored locally on the device. The menus use compact semantic colors: green for Auto/ready, blue for selection, yellow for checking/pending, and red only for restricted/paid or error meaning. Background tints remain subtle.

See [Manual Chat Model Allowlist](MANUAL_CHAT_MODEL_ALLOWLIST.md) for the chat selector policy, and [Provider Availability and Verification](MANUAL_PROVIDER_AVAILABILITY.md) for credential, quota, and live-inference rules.
