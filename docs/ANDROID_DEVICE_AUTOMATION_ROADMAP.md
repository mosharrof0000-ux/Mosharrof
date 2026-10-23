# Android Device Automation Engine — Extensible Roadmap

## Goal

Build MOSHARROF's Android companion into an extensible, human-like device assistant that can observe a screen, understand the current UI, execute bounded actions, verify the result, recover from expected errors, and accept new capabilities without rewriting the core engine.

This is a staged engineering target, not a claim that unrestricted physical-device control is already available.

## Architecture: stable core, pluggable capabilities

1. **Device bridge** — explicit connection and health checks for Android Emulator and an owner-authorized physical device (ADB/instrumentation or an on-device companion). Never imply a cloud runner can touch a disconnected phone.
2. **Observation adapters** — UIAutomator/accessibility hierarchy first; screenshots and OCR where available; optional visual model adapter later. Store timestamped observations and redact secrets before artifacts.
3. **Action adapters** — tap by stable resource ID/accessibility label, text entry, swipe/scroll, Back/Home, app launch, permission-settings deep links, and file selection through scoped Storage Access Framework. Every action has a timeout and expected postcondition.
4. **Capability registry** — each feature lives in its own small module with a unique ID, version, required Android permissions, supported OS range, preconditions, action plan, postconditions, cleanup, risk level, and tests. Unknown capabilities must fail closed.
5. **Task planner/coordinator** — converts a user goal into a visible sequence of approved capabilities; supports pause, cancellation, deadlines, retries only for idempotent actions, and recovery checkpoints.
6. **Verifier** — compare before/after UI state, app/package state, logs and screenshots. A tap succeeding is not enough; the intended postcondition must be observed.
7. **Evidence and memory** — per-run JSON report, redacted logcat, UI hierarchy, screenshots, app version/build SHA, and artifacts. Label browser, emulator, and physical-device results separately.
8. **Update manager** — download/verify candidate APK, compare version/signature, install/update, run smoke and regression suites, and retain a rollback artifact. On a disposable emulator, test fresh install, in-place replacement, uninstall, and reinstall. Never uninstall a user's real app or erase its data without explicit approval and backup/restore plan.

## Test lifecycle

- Validate APK existence, package ID, signing consistency, manifest and permissions.
- Fresh install -> launch -> screen capture -> baseline smoke tests.
- Explore each feature through its registered test, not blind taps. Confirm preconditions and expected results.
- Exercise pause/resume, Back, denied permissions, offline/network errors, app crash/relaunch and timeout recovery.
- Update from a previous release APK to the candidate; verify data migration and app version.
- Uninstall only in the disposable test environment; verify package removal; reinstall and relaunch.
- Run regression tests; upload a machine-readable report and screenshots.
- Block merge/release on required failures. Never turn an untested or skipped feature green.

## Human-like feature coverage

Each registered feature should cover: screen recognition, accessible name/target, action, expected state change, error message handling, cancellation, recovery, and a screenshot/log evidence bundle. Voice commands should be transcribed into an explicit proposed action plan before any destructive or sensitive action.

## Permission and safety boundaries

- Accessibility, overlay, notification access, microphone, contacts, calls, location, files, camera and screen-capture permissions remain visible and user-controlled.
- Do not bypass Android permission prompts, security locks, authentication, or platform restrictions.
- Require explicit confirmation for deleting user data, uninstalling a real-device app, sending messages/calls, purchases, changing security settings, or actions with external consequences.
- Use test accounts and disposable emulator data for destructive tests; redact tokens, messages, contact details and other private data from artifacts.
- Keep a clear audit log and a Stop/Cancel control.

## Acceptance gates

- Unit/contract tests for each capability adapter.
- Emulator E2E: install, launch, UI hierarchy, screenshot, interactions, update, uninstall, reinstall.
- A physical-device test is reported only when an authorized device connection actually ran and produced evidence.
- No merge/deploy until required checks pass; preserve the known-good release and rollback path.
- Adding a feature requires a dedicated module, manifest/permission review, docs, tests and artifact evidence.

## Current status

The current PR adds browser/PWA interactive QA and an Android Emulator lifecycle script. It is still a foundation: the full capability registry, reliable visual/OCR understanding, broad feature-specific E2E coverage, previous-release upgrade testing, and owner-authorized physical-device acceptance must be implemented and proven separately.

## Blocker: Android Real-Chat QA
- Verification of fresh main-branch APK/WebView real-chat evidence is currently blocked by lack of physical-device access in the CI environment. Emulator-based smoke tests are passing, but real-chat verification requires manual device-side confirmation.