# MOSHARROF Android Agentic Automation — implementation contract

## Goal

Turn a Bengali voice or text instruction into a bounded, inspectable plan; execute only actions supported by the installed Android APK and the permissions the owner explicitly enabled; verify the result; and report success or failure truthfully.

This is an implementation contract and phased foundation, **not a claim that universal device control is already implemented**.

## Architecture

1. **Voice input** — use the existing microphone/STT path; do not keep a microphone open continuously without a visible, user-started session.
2. **Intent planner** — translate Bengali/English instructions into typed actions. Unknown or ambiguous commands stop and ask for clarification.
3. **Policy gate** — classify actions as read-only, navigation, reversible setting change, communication, or destructive/sensitive. Require a visible preview and explicit confirmation for consequential actions.
4. **Android execution adapter** — Capacitor bridge for safe OS intents; an optional AccessibilityService can be added only as a separately user-enabled native capability. It must never silently enable itself or bypass Android's consent UI.
5. **UI perception** — prefer AccessibilityNodeInfo text/content descriptions and stable view identifiers. OCR/screenshot interpretation is a fallback, not a source of authority; never infer success solely from a tap.
6. **Executor** — execute one step at a time, re-read state after each step, enforce timeouts/retries, stop on unexpected screens, and provide a cancel control.
7. **Verifier and audit** — verify observable postconditions and show completed/failed/skipped steps. Keep a local minimal audit record; never log passwords, OTPs, payment credentials, or full private screen contents.
8. **Recovery** — bounded retries, safe stop, return-to-app navigation where possible, and a human-readable explanation when Android or another app blocks an action.

## Android platform requirements and constraints

- Accessibility is enabled by the device owner in Android Settings. A service must declare its metadata/configuration and describe its purpose clearly. Use only the minimum event types and capabilities required.
- Do not request `BIND_ACCESSIBILITY_SERVICE` as a runtime permission. It is a service protection/manifest declaration; the user explicitly enables the service in Settings.
- Overlay permission is optional and must be separately granted by the user; it is not required for a foreground, in-app approval UI.
- `RECORD_AUDIO` requires runtime permission and a clear microphone-use affordance.
- `QUERY_ALL_PACKAGES` is restricted by Google Play policy. Prefer package visibility declarations and the Android app-launcher intent query where possible.
- `WRITE_SECURE_SETTINGS` is signature/privileged-level in normal distribution and is not a general runtime permission. Do not depend on root or ADB grants for a consumer release. Use Android-owned Settings screens or supported public APIs.
- MediaProjection requires a system consent flow for each capture session. Do not assume permanent or silent screen capture.
- Accessibility gestures and node actions may fail due to OEM versions, secure windows, app design, permission screens, or apps that intentionally block automation.
- Do not automate payment submission, purchases, transfers, credential entry, OTP entry, security controls, or destructive actions without a fresh, explicit confirmation. Never attempt to bypass authentication or app security.

## Phases and acceptance gates

### Phase A — planner contract
- Parse a small allowlist of Bengali/English commands into typed, previewable plans.
- Mark unsupported actions rather than pretending to execute them.
- Add tests for multilingual intent, multi-step ordering, ambiguity, unsafe requests, and permission requirements.

### Phase B — user-mediated native execution
- Keep current DeviceControl settings shortcuts.
- Add a capability/readiness report and explicit user confirmation for each action.
- Verify the Android intent was launched; do not claim that the user completed the setting change.

### Phase C — optional AccessibilityService
- Add native service, XML metadata, settings entry, enablement/readiness check, event filtering, node search and click, bounded gestures, cancellation, and safe-stop behavior.
- Never auto-enable the service. Exclude password/OTP fields from collection; do not transmit arbitrary screen trees to a remote model.
- Add emulator contract tests and physical-device tests on supported Android versions.

### Phase D — perception and task execution
- Add user-consented MediaProjection capture only if node inspection is insufficient; OCR locally where feasible.
- Use a model to propose plans, not to bypass the policy gate. Validate every proposed action against a strict schema and allowlist.
- After each action, inspect a narrow postcondition and stop if it is not met.

### Phase E — release readiness
- CI, architecture/security tests, APK archive verification, regression tests for chat/Gemini/TTS, and manual physical-device validation.
- Publish a capability matrix naming what is supported, permission state, last verification, and known OEM limitations.
- Do not call the system universal until all advertised actions pass end-to-end tests on the supported device matrix.

### Phase F — user-authorized file and media management
- Use Android Storage Access Framework (SAF) document/tree pickers so the owner chooses which folders the app may access; do not promise unrestricted filesystem access.
- Implement list/create/rename/move/copy with path-boundary checks, collision previews, cancellation, and undo where possible.
- For photos, group into proposed albums/folders without silently moving originals; show a review list before applying changes.
- For duplicate audio/photos, first scan by size + cryptographic hash and then show exact matches; similar names or perceptual similarity alone must not trigger deletion. Deletion requires a fresh confirmation and recoverable trash where supported.
- Add read-only diagnostics first (permission state, app/version/build, recent non-sensitive error codes). Repair plans must cite evidence, prefer reversible changes, and verify each postcondition.
- Keep a capability registry with explicit `available_mediated`, `planned`, and `blocked` states. A granted permission never turns an unimplemented capability into a ready one.

## Capability readiness registry

`core/android-agent-capabilities.js` is a metadata contract, not an executor or permission grant. It currently lists 21 capability IDs across device navigation, accessibility, screen perception, files, media, diagnostics, apps, communications, and security. Only mediated settings navigation and user-reviewed communication drafts are marked available at this stage; file/media operations and cross-app automation remain planned. Security credential handling, autonomous payment submission, and security bypass are blocked.

## Current known baseline

PR #632 adds a user-mediated DeviceControl plugin that opens Android-owned settings. PR #643 proposes user-confirmed dialer/SMS/email drafts. Neither is an AccessibilityService or a universal screen-tapping agent. This document keeps that distinction explicit.
