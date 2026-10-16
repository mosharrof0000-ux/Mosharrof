# MOSHARROF AI — Master Device Control Catalog

**Status:** partial implementation; this catalog is not a claim that every capability is implemented or device-verified.  
**Owner:** MOSHARROF AI Device Manager  
**Scope:** Android phone first; other devices only through explicitly supported integrations.  
**Safety baseline:** per-action approval, least privilege, result verification, audit trail, rollback where possible, no direct edits to `main` or live deployment.

## Purpose

This catalog is the source of truth for planning device-control capabilities. It separates what the assistant may understand, what the platform can technically do, what permissions are required, and what is actually verified. A capability is not considered available merely because it appears in this document.

## Non-negotiable execution contract

For **every action**, including read-only actions that access personal data:

1. Parse the user's instruction and describe the intended action and target.
2. Check platform/API support, current permission state, scope, and policy.
3. Explain any permission needed and why; request only the permission required for this action.
4. Ask for confirmation immediately before performing the action. A prior permission grant is not blanket consent for future actions.
5. Execute only the approved action and within its stated scope.
6. Verify the result using an independent signal where possible (API result, state re-read, file hash, test result, or explicit provider receipt).
7. Report success, partial success, failure, or unverified status truthfully. Record non-sensitive audit metadata.
8. Revoke temporary access or end the session when the task completes, where supported.

If permission is denied, expired, revoked, unavailable, or outside scope, stop that action and offer a safe alternative. Never silently broaden access.

## Existing global policy takes precedence

The current repository policy says DELETE and destructive operations are permanently blocked, scope escape is blocked, and activation without tests is blocked. Therefore this catalog **does not authorize deleting files, uninstalling apps, wiping data, destructive cleanup, or destructive repository operations**, even if a user confirms. Initially, cleanup features may only identify candidates, estimate space, and prepare a reversible proposal. Any future change to this global policy requires a separate, reviewed policy decision and must not be smuggled in through a feature module.

Never request broad storage, Accessibility, notification, location, or contact access at app startup simply because it might be useful later. Ask in context. Android runtime and special permissions are distinct; special permissions may require the user to navigate to Android Settings. The app must re-check permission at the time of use and degrade gracefully when denied.


## Current testable Android bridge (partial)

The current main branch includes a Capacitor `DeviceControl` plugin that returns manufacturer/model/Android version and opens Android-owned Wi-Fi, Bluetooth, display, sound, battery, location, and app settings pages. It does not silently toggle settings, run arbitrary commands, launch apps, place calls, read files, or access contacts. The user completes any change in Android Settings.

The Python `DeviceActionBroker` and `SQLiteAuditLedger` introduced alongside this catalog are separately tested policy primitives; they are **not yet wired into the Android bridge or a global runtime audit service**. Do not describe them as protecting every current UI action. Higher-risk capabilities remain planned or platform-gated until a reviewed adapter, explicit per-action approval, point-of-use permission checks, safe audit writes, independent result verification, and physical-device acceptance tests are integrated.

## Capability status vocabulary

- **Existing / CI-built:** evidence exists in the repository or automated build, but device behavior may still be unverified.
- **Partial:** a limited pathway exists; only documented actions are supported.
- **Planned:** design only; not yet implemented.
- **Blocked by platform/provider:** needs a system capability, provider API, device-owner privileges, user interaction, service credentials, or a policy-compliant alternative.
- **Verified:** the exact action passed automated tests and the required device/provider acceptance checks. A successful APK build alone is not enough.

## Capability domains

| Domain | Planned abilities | Permission/integration boundary | Verification target |
|---|---|---|---|
| Voice and intent | Bengali speech/text commands, clarification, task plans, cancel/review/send, progress and result reports | Microphone and speech service only when invoked; AI provider quota and network are separate | Permission grant/deny, partial transcript, cancel, submit, provider error/fallback |
| Floating control | Small movable/hideable voice control, restore from notification, Quick Settings entry | Overlay special access; notification permission on applicable Android versions; user adds Quick Settings tile | Drag, move, hide, restore, reboot/process restart, denial behavior |
| App launching | Open supported apps by name; launch approved deep links/intents | Package visibility and app-specific supported entry points | Installed/missing app, ambiguous names, unsupported app, no accidental command |
| Contacts and calling | Find contact, show matching name/number, request confirmation, then initiate supported call flow | Contacts/phone permissions as needed; calling may expose a paid or external action | No match, duplicate names, denied permission, cancel, confirmed call intent |
| Messaging and email | Draft text, choose recipient, open supported app/share flow; send only after explicit per-message confirmation | Default app/provider APIs, account login, messaging permission and provider policies | Recipient/body preview, cancel, send receipt where available |
| Files and media | Search/list/read selected files, inspect metadata, summarize supported documents, create/export files, copy to approved destination | Use Android picker/MediaStore or narrow access first; broad file access only if strictly necessary and separately approved | File scope, permission denial, file size/hash, export path and readability |
| Storage and memory | Report storage totals where available, locate large files/possible duplicates, explain RAM pressure | Other apps' private storage/RAM and detailed battery stats may be unavailable to ordinary apps | Totals compared with Android Settings; do not claim inaccessible metrics |
| Device settings | Read available state; open the exact Settings page for connectivity, display, sound, battery, permissions | Many system toggles are restricted; do not promise direct changes that Android does not expose | Supported device/API matrix, fallback to Settings, no hidden toggles |
| Camera, screen and OCR | Take a user-requested photo, scan QR/document, OCR and summarize selected image/screen content | Camera and screen-capture consent; hardware optional; sensitive screens may be protected | Camera denial, screen capture consent, OCR accuracy and file output |
| Location and sensors | One-time location and supported sensor readings for a named task | Runtime/background location restrictions; ask only when needed | Approximate/precise denial, unavailable hardware, stale reading |
| Notifications and routines | Create reminders, timers, supported alarms, scheduled local tasks, daily summaries | Notification/exact-alarm/background execution limits vary by Android version/OEM | Schedule persistence, firing behavior, cancellation, reboot and battery restrictions |
| Network and Bluetooth | Show available network state; open network settings; supported Bluetooth pairing/transfer assistance | Android version-specific restrictions and pairing consent | Unsupported toggle falls back to Settings; pairing requires user choice |
| Health and diagnostics | Explain crashes, permission failures, storage pressure and connectivity; collect user-approved diagnostics | No claim of antivirus, complete RAM visibility, or privileged OEM data | Reproducible diagnostic report, source and confidence for each finding |
| Research and web | Search, summarize, translate, compare sources, organize user-approved notes | Internet, provider access, data minimization; sources should be cited in reports | Source traceability, offline fallback, stale/failed request labeling |
| AI engine and voice output | Provider-neutral model routing, TTS/STT fallback, quota/error tracking, style controls where supported | Server-held secrets, provider terms, quotas, cost/consent boundaries | Provider actually used, latency/error metadata, fallback reason, no secret logging |
| Coding and repository operations | Inspect repo, create feature branch/commit/PR, run tests/builds, analyze logs, package artifacts | Narrow GitHub App/token scopes; protected branch; no secret values in chat/logs | PR URL, exact commit, checks, artifact and rollback plan |
| Multi-device integrations | Extend to tablet/desktop/TV or connected devices via approved adapters | Per-device capability discovery and separate authorization | Capability negotiation and unsupported-device fallback |
| Personal knowledge and memory | Search authorized conversation/project notes, keep task history and user-approved preferences | Data boundaries, retention controls and deletion restrictions of global policy | Correct source references, scope checks, no cross-project leakage |
| Security and audit | Permission ledger, approval record, action result, provider/build status, temporary access expiry | Avoid logging message bodies, credentials, contact details or sensitive payloads unnecessarily | Audit completeness, redaction, permission revocation and incident test |

## Per-action approval record

Before execution, create an in-memory task envelope with:

- `action_id`, human-readable action, target and requested scope;
- exact permission(s) required and current grant state;
- risk class: `read_private_data`, `local_change`, `external_effect`, or `restricted`;
- user approval for this exact action (yes/no/cancel);
- precondition checks, execution method, timeout and cancellation path;
- expected result and verification method;
- audit event ID and cleanup/revocation steps.

Do not store raw audio, full messages, contact lists, passwords, API keys or authentication tokens in routine logs. Retain only the minimum metadata needed to troubleshoot the action.

## Implementation roadmap

### Phase 0 — Baseline and safety (first)
- Preserve the current website/PWA source and existing Gemini/chat/TTS paths.
- Record main SHA, open PRs, CI runs, current permission profiles and recovery route before changes.
- Keep the Android work in its existing PR; implement this catalog separately on a feature branch.
- Add machine-readable capability definitions and schema/policy tests.
- Acceptance: no edits to `main`; JSON validates; all actions require per-action approval; delete/destructive remain denied.

### Phase 1 — Permission and task broker
- Build one central permission-check interface that checks each action at point of use.
- Separate runtime permissions, special Settings access, provider credentials, app-specific capabilities and user confirmation.
- Provide an action preview, cancel path, denied-permission fallback, and an audit result.
- Acceptance: granted, denied, revoked, permanently denied, expired and unsupported states are tested; no action proceeds after cancel.

### Phase 2 — Reliable existing Android voice shell
- Verify microphone initialization and repeated use on real target devices.
- Verify movable overlay, hide/restore, Quick Settings tile, app launch, contact matching and call confirmation.
- Keep recognized speech reviewable before submit; do not represent the current SpeechRecognizer path as raw-audio streaming.
- Acceptance: automated APK build + physical-device checklist; no regression to web UI.

### Phase 3 — Safe read-only device inventory
- Implement capability discovery, installed-app launching, selected-file search, storage summaries and permission-state explanations.
- Avoid broad file access by default; use Android picker/MediaStore where possible.
- Acceptance: least-privilege tests, denial tests, accurate unsupported-state reports.

### Phase 4 — User-confirmed local actions
- Add creation/export, reminders, supported settings intents, camera/OCR and supported share/draft workflows.
- Any local modification must preview target and scope; destructive operations remain blocked by global policy.
- Acceptance: before/after verification and cancellation tests for every action family.

### Phase 5 — External actions and integrations
- Add calling/messaging/email/provider workflows using supported intents/APIs and per-action confirmation.
- Add server-mediated AI/TTS fallback with server-held credentials, bounded retries, quota-aware routing and redacted logs.
- Acceptance: recipient/target preview, cancel, provider receipt where available, retry limits, no duplicate external action.

### Phase 6 — Automation engine
- Compose multi-step workflows from individually authorized actions; re-confirm each action immediately before it executes.
- Support pause, cancel, timeout, retry budget, resumable state, and a step-by-step result report.
- No blanket permission or hidden background execution. Schedule only actions that Android/provider policy permits.
- Acceptance: fault injection at every step, no repeated external side effects, resume/cancel tests.

### Phase 7 — Diagnostics, memory and multi-device adapters
- Add source-backed diagnostics, authorized personal knowledge retrieval, and device-specific adapters.
- Keep Al-Quran Research independent unless a separately reviewed integration is approved.
- Acceptance: source traceability, scope isolation, unsupported hardware tests, privacy/log-redaction checks.

### Phase 8 — Release and recovery
- PR → automated tests → APK build/artifact → review → protected merge → Pages health check (only when relevant) → device acceptance → release report.
- Keep the currently working version recoverable; do not merge or deploy when required checks fail.
- Acceptance: release checklist, artifact digest, exact commit/PR references, known limitations and tested recovery path.

## Required test matrix

For each action family, test:
1. permission already granted;
2. permission denied;
3. permission revoked after grant;
4. special access not enabled;
5. user cancels confirmation;
6. target app/file/contact/device missing or ambiguous;
7. network/provider quota/timeout failure;
8. repeated invocation (idempotency or duplicate prevention);
9. process death/restart and background limits where relevant;
10. result verification and truthful reporting.

## Release gates

A capability may be marked **Verified** only when:
- unit/schema/policy tests pass;
- relevant integration or emulator tests pass;
- physical-device checks pass when hardware/OS behavior matters;
- per-action approval and least privilege are demonstrated;
- result verification and error paths are tested;
- no secret/personal payload appears in logs;
- the change is in a feature branch/PR with an inspectable diff;
- the current live state remains unchanged until authorized merge and deploy checks succeed.

## Sources

- Android permissions overview: https://developer.android.com/guide/topics/permissions/overview
- Request runtime permissions: https://developer.android.com/training/permissions/requesting
- Request special permissions: https://developer.android.com/training/permissions/requesting-special
- Repository core policy: `policies/CORE_POLICY.md`
- Repository permission profiles: `config/permission_profiles.json`

## Current status

This document and its machine-readable catalog define the plan only. A capability must not be reported as implemented until code, tests, PR checks and required device/provider validation provide evidence.
