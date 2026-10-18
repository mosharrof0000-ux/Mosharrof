# Android Device Acceptance Checklist

Use this checklist for each candidate APK. A successful build or JVM test is not proof that the feature works on a real phone.

## CI evidence (required before review)
- [ ] Debug APK builds from the exact PR head.
- [ ] JVM unit tests pass from the exact PR head.
- [ ] Android emulator instrumentation tests pass from the exact PR head.
- [ ] The uploaded APK and instrumentation report belong to that same workflow run/commit.
- [ ] Any emulator boot/ADB failure is separated from an actual test assertion failure and rerun after diagnosis.

## Install and startup (physical device)
- [ ] Install the candidate APK without uninstalling the current stable app first; record Android version and device model.
- [ ] App launches without crash and core controls remain reachable after scrolling.
- [ ] Back navigation and app resume work; no stuck dialog or blocked screen remains after cancellation.
- [ ] Speech recognition explains when the device has no compatible recognizer; text command entry still works.

## Permission and command safety
- [ ] Accessibility disclosure is shown before Android Accessibility Settings opens.
- [ ] Choosing “এখন নয়” closes the disclosure and does not enable consent or open Settings.
- [ ] Accessibility remains off unless the device owner explicitly enables it in Android Settings.
- [ ] A proposed action is shown before execution; cancel leaves the target app and data unchanged.
- [ ] Unknown, ambiguous, expired, duplicate, or risky commands fail closed.
- [ ] No command can bypass Android's own permission, installer, uninstaller, Clock, or Calendar confirmation.

## Screen inspection and media privacy
- [ ] Screen inspection runs only after a user action and reports a bounded, redacted result.
- [ ] Screenshot, gallery-photo, and audio uploads never start before a separate explicit consent action.
- [ ] Missing/invalid provider keys and network failures show a clear recoverable error without losing the selected local file.
- [ ] API credentials remain encrypted at rest; secrets never appear in logs or reports.

## Files and media organization
- [ ] File operations stay inside the user-selected Storage Access Framework folder.
- [ ] Preview lists the proposed renames/copies/moves before changes are made.
- [ ] A failed or size-mismatched copy does not delete the original.
- [ ] Moving/deleting requires its own confirmation; cancellation leaves originals intact.
- [ ] Bengali song titles and multi-topic tags preserve the original file when analysis is uncertain.
- [ ] Duplicate and suspicious-extension reports are advisory; no automatic deletion or claim of antivirus protection is made.

## Task lifecycle and compatibility
- [ ] Each operation shows progress and a final success/failure/unknown result.
- [ ] Cancel stops pending work; already completed side effects are reported accurately and are not repeated blindly.
- [ ] Timeouts and app/process restarts do not silently repeat non-idempotent actions.
- [ ] Test on at least one real device before release; record OEM-specific permission and battery-management differences.

## MOSHARROF chat integration and release gate
- [ ] Remote pairing/authentication, request expiry, replay protection, rate limiting, and result callbacks are implemented and tested before enabling remote control.
- [ ] Chat receives a redacted, correlated result for each task; timeout and cancellation are distinguishable from success.
- [ ] Release signing, upgrade/install validation, and artifact provenance are checked.
- [ ] Main and Live Pages remain unchanged until a separate reviewed integration PR passes its required gates.

**Release rule:** do not mark a section complete without a test result or evidence link. Emulator-only evidence does not satisfy physical-device acceptance.
