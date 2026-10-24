# Live Real-Chat Green Baseline Lock

## Decision
Keep the already-passing Live website real-chat result and its screenshot evidence as a separate frozen baseline. The Android APK's current failure to reproduce that behavior is a separate compatibility/integration issue and does not invalidate the Live result.

## Scope separation
- **LIVE-BASELINE-PRESERVED**: preserve the exact successful Live commit, workflow/run link, screenshot artifacts, and test transcript when their exact identifiers are known. Do not rewrite or delete evidence.
- **ANDROID-APP-PENDING**: APK/WebView/device behavior remains a separate investigation. Fixes must use a new feature branch and PR; do not change the frozen Live baseline to make Android tests pass.
- **FUTURE-BRIDGE-RETEST**: when authenticated web-to-app pairing and correlated result callbacks are implemented, test that integration separately. Do not retroactively change the old Live test result.

## Important evidence rule
This document records the lock policy, not the identity of the specific successful Live run. Do not label a commit or screenshot as verified until the exact commit SHA and evidence URLs are linked. If they are not yet recovered, record the baseline as **PRESERVED-REQUESTED / EVIDENCE-LINK-PENDING**, not GREEN-LOCKED.

## Android diagnosis, kept separate
Compare the Live site and installed APK on:
1. exact deployed web commit/build;
2. WebView URL, JavaScript and network behavior;
3. API/provider configuration and CORS/authentication;
4. deep-link interception and Android app lifecycle;
5. request/response correlation and timeout/error reporting;
6. screenshots and logs from the same test attempt.

Do not claim Android passes based only on website success, emulator startup, or APK build success. Do not claim physical-device success without physical-device evidence.

## Change control
- Keep main and Live Pages untouched while diagnosing.
- Any Android fix goes in a small isolated branch/PR and must pass its relevant CI checks before merge.
- Preserve the Live screenshot/run artifacts unchanged.
- The old Live baseline can be referenced for comparison but is not proof that the Android APK is working.
- A future bridge may be tested later, in its own PR, after explicit pairing and task-result reporting exist.
