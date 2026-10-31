# Manual Chat Model Allowlist

## Manual chat model allowlist

- The manual chat menu intentionally exposes only Auto, Gemini 3.6 Flash, and the two Cloudflare Workers AI models documented as the default fallback pair.
- Unverified Gemini model IDs and optional Groq/OpenRouter choices are hidden from manual selection until their availability can be confirmed. This is a UI allowlist, not a claim that those services are permanently broken.
- Auto routing still tries Gemini, Cloudflare Workers AI, Groq, and OpenRouter in server-side order when the relevant provider is configured. Hiding a manual option does not disable that automatic fallback.
- A model should be restored to the manual menu only after a real provider request succeeds and the result is captured in CI/health evidence; configuration presence alone is not a successful inference test.
