# Android Agent Bridge tests

- `node tests/test_device_bridge_worker.mjs`: pairing-code expiry, browser approval, command signature, nonce/replay checks, bounded queue, result correlation and revocation.
- Android Agent CI: compiles the app and runs the authenticator/unit tests.
- Acceptance remains incomplete until a physical Android device completes a paired install/uninstall round trip with visible result evidence.
