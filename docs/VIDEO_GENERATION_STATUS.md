# MOSHARROF AI — Video Generation Status

## Current state

The separate `mosharrof-video-generation` Worker and Bengali UI are implemented with a safe disabled-by-default configuration. The service requests a 10-second, 720p video from `fal-ai/wan/v2.7/text-to-video` only when the owner explicitly enables it and configures `FAL_KEY`.

**This does not mean live video generation has been verified.** The current Worker config sets `VIDEO_GENERATION_ENABLED=false`; the UI explains that the feature is disabled and does not submit a paid request. No FAL key or provider credits are assumed.

## Before enabling

1. Configure `FAL_KEY` as a Cloudflare Worker secret; never put it in the browser or repository.
2. Configure a durable Cloudflare edge rate limit for the video Worker. The in-memory per-isolate guard is an additional safety layer, not a durable cost-control boundary.
3. Review provider pricing, account credits, usage limits, and the safety policy.
4. Change `VIDEO_GENERATION_ENABLED` to `true` only after explicit owner approval and a reviewed deployment.
5. Run one controlled end-to-end generation, verify the returned video URL and duration, and confirm the UI reports provider failures without claiming success.

Until these conditions are met, video generation stays disabled. MOSHARROF AI chat, TTS, and image routes are unaffected.
