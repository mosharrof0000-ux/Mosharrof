# Android Agent Bridge

Owns the browser-side pairing panel and the Cloudflare Durable Object protocol for authenticated Android package commands.

## Safety
- Pairing codes expire after five minutes; browser/device credentials are not written to chat history.
- Commands are allowlisted, signed, expiring, replay-protected and correlated by request ID.
- Android keeps final install/uninstall confirmation. A worker or system-screen launch is never accepted as success.
- Polling is foreground-only; disconnect/revoke clears the pairing.

## Verification
Run `node tests/test_device_bridge_worker.mjs` and the Android Agent CI. Follow `docs/android-device-pairing-acceptance.md` before enabling this feature in production.
