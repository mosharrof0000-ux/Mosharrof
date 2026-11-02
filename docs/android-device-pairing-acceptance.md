# MOSHARROF Android device-pairing acceptance

## Current protocol

- The Android Agent generates a short-lived six-digit pairing code and a 256-bit device secret.
- The secret is encrypted in app-private preferences with an AES-GCM key held by Android Keystore.
- The browser submits the pairing code only through the dedicated **Android ফোন যুক্ত করুন** panel; the code is not sent as a chat message.
- The Worker accepts only allowlisted package actions: INSTALL_APK, SEARCH_PLAY_STORE, UNINSTALL_APP. Commands are signed with HMAC-SHA256, carry a request ID, nonce, issue time and two-minute expiry, and are verified by the app before dispatch.
- The app polls only while its Activity is in the foreground. The phone's local confirmation dialog and Android's system installer/uninstaller remain mandatory.
- Terminal results are correlated by request ID. Successful install/uninstall must include verified package state; Play Store search can never be reported as installation success.
- Browser pairing credentials are held in sessionStorage; use the panel's disconnect action to revoke the pairing.

## Chat commands

- `install apk` — asks the paired phone to open the APK picker; the user selects the APK and confirms the Android installer.
- `install <app name>` — asks the paired phone to open Play Store search. This is a hand-off only, not an install-success claim.
- `uninstall <app name or package>` — asks the paired phone to resolve one exact installed launcher label/package and then open the local and Android uninstall confirmations.
- `disconnect android` — revokes the active pairing from the browser session.

## Required validation

- [ ] Exact-head GitHub Actions Mosharrof Tests passes, including tests/test_device_bridge_worker.mjs.
- [ ] Exact-head Android Agent CI builds the APK, passes JVM tests and passes emulator smoke.
- [ ] Worker deploy completes with the Durable Object migration and /health reports the new build.
- [ ] Browser pairing rejects a wrong/expired code and a revoked browser token.
- [ ] A physical phone displays the pairing code; web approval succeeds; the phone's foreground agent reports paired.
- [ ] Physical phone: install a harmless test APK, confirm the Android system prompt, and capture before/after package/version evidence.
- [ ] Physical phone: uninstall a harmless test app, confirm the Android system prompt, and capture before/after package-state evidence.
- [ ] Verify cancelled, expired, replayed and malformed commands never execute and never display success.
- [ ] Capture a browser screenshot showing the correlated terminal result for both install and uninstall.

## Evidence status

CI and physical-device acceptance are not marked passed by this checklist. A green build, an opened system screen, or a queued command is not evidence that a real installation/removal completed. Physical-device evidence must be attached to the exact accepted commit before calling the feature complete.
