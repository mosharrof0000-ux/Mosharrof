# MOSHARROF Permission-First Total Android Device Control

## Product contract

MOSHARROF should provide the widest device-management capability Android officially exposes to an ordinary app, plus separately granted special-access capabilities where appropriate. It must never bypass Android's permission model, exploit vulnerabilities, conceal actions, or pretend a capability exists when the OS/provider does not expose it.

**Every state-changing action requires a fresh, understandable confirmation from the owner.** Permission to use a capability is not blanket consent to execute future destructive actions.

Before confirmation, show:
- the exact action and target(s);
- a count and preview of affected files/apps/settings;
- expected result and risks;
- whether the action is reversible;
- the permission required and why;
- Confirm and Cancel options.

Use the least-privilege Android API. Denial or unavailable permission must leave data unchanged. Record action, target summary, permission/approval decision, result, and timestamp in a durable audit log where available. Never log file contents, tokens, or private media.

## Capability areas

### 1. All user files and media
- Support photos, screenshots, videos, music/audio, documents, downloads, archives, and other file types—not just duplicate images.
- Use Android Storage Access Framework (SAF) document/file/folder pickers so the owner chooses which locations MOSHARROF can access. Use MediaStore for media only where Android permissions allow.
- Within granted URI trees: enumerate, search, preview metadata, create folders, copy, move, rename, and organize files where the provider supports those operations.
- Support filtering by type, size, date, location/provider, and name; show progress and per-item results for batch operations.
- Never imply access to every private app sandbox. Scoped storage and cloud/document providers may limit listing, rename, move, or delete.
- Deletion is staged: select -> review exact targets -> explicit confirmation -> perform -> report per-item result. Prefer Trash/recycle support when the provider offers it.
- Never silently overwrite. Use collision-safe names or ask.

### 2. Duplicate detection and storage cleanup
- Scan only user-granted locations or MediaStore collections for which Android permissions are granted.
- Find candidates first by size/type and then compare content hashes; do not call files duplicates based only on matching names.
- For photos/videos/audio/documents, show thumbnail or file-type icon, path/album, dimensions or duration when available, size, and hash-match confidence.
- Group candidates and suggest a keeper, but never choose/delete automatically. Let the owner inspect and select each item or group. Confirm before moving to Trash/deleting and show the exact keeper.
- Storage cleanup starts as read-only analysis. Clearing another app's private cache/data is not generally available to ordinary apps; use Android's app-info/storage screens or supported OS APIs instead.
- Report actual free/used storage and the measurable expected change where the OS exposes it; never promise a storage gain that has not been measured.

### 3. Apps and system apps
- Read the app inventory only where Android version, package-visibility declarations, and permissions permit it.
- Launch apps and open Android App Info/permission/settings screens.
- Where Android supports it, request the standard user-mediated uninstall flow for an ordinary user-installed app. Never silently uninstall.
- **System/preinstalled apps must never be uninstalled by MOSHARROF.** Do not attempt package-manager bypasses, root commands, hidden APIs, or device-owner privileges obtained without explicit owner-managed provisioning.
- Some preinstalled apps can be disabled or have notifications/background activity restricted only through OS UI or special role/management policies. Offer those controls only when the OS explicitly supports them and clearly warn about consequences; never promise every system app can be stopped or disabled.
- Force-stop, background limits, battery optimization, notifications, permissions, and default-app roles differ by OS/OEM. Open official system screens or use documented APIs only.
- Do not claim universal control over the private data or internal behavior of every third-party app.

### 4. Device settings and status
- Begin with read-only device diagnostics and opening OS settings screens.
- Add direct toggles only when a documented Android API allows the app to change that specific setting and the owner has granted the required access.
- Wi-Fi/Bluetooth, mobile data, GPS/location, airplane mode, and certain secure settings are restricted on modern Android; do not simulate full control where the OS disallows it.
- Do not bypass screen lock, device encryption, OEM protections, work profiles, or other apps' private sandboxes.

### 5. Memory, performance, storage, and battery
- Report available/used storage and memory using supported APIs; identify large files and likely safe cleanup candidates.
- Distinguish physical RAM, available memory, storage space, and OEM-provided virtual-memory/swap features. Software cannot increase the phone's physical RAM.
- Explain which user-approved actions may reduce resource pressure, and show evidence/expected impact where measurable. Do not promise a generic "RAM booster" or claim that killing processes in bulk improves performance.
- Android owns process lifecycle; do not force-stop background apps in bulk. Use official battery-optimization/settings flows and recommend only supported actions.
- Make recommendations first; perform changes only after explicit approval.

### 6. Malware and security checks
- Provide a security status page for app source/installer information where exposed, risky permissions, suspicious file indicators, and links to trusted platform security tools.
- File-extension, name, or hash reputation checks are indicators—not proof that a file is safe or infected. Do not execute suspect files to test them.
- Actual malware scanning/removal requires a maintained scanning engine, trusted signatures/reputation service, and explicit access to the scanned content. Do not claim "virus removed" unless a scanner confirms the result.
- Quarantine only in an app-controlled or user-granted location where supported; preview the exact file, explain consequences, and require confirmation before quarantine or deletion. Do not disable Play Protect or weaken device security.

### 7. Alarms, calendar, and everyday tasks
- Add native integrations for creating/editing alarms and timers, and for creating calendar events/reminders, using documented Android intents/APIs and the minimum required permissions.
- Show a confirmation preview of time, date, recurrence, title, reminder, calendar, and time zone before creating or changing an item. Revalidate before execution.
- If the device's clock/alarm/calendar app handles the final action, report that the system screen was opened or the request was handed off; do not claim completion until success can be verified.
- Add reminders and task workflows only where the chosen Android API or app integration supports them; third-party app control varies.

### 8. Future-ready capability adapters
- Maintain a versioned capability registry with stable IDs, minimum Android/API level, permission requirements, risk class, supported operations, and explicit unavailable reasons.
- Use small native adapters behind a shared approval gateway. Each adapter must declare what it can actually do, probe runtime support, fail closed, and provide tests and an audit result.
- New Android APIs, OEM features, scanners, or integrations should be addable as separately tested modules without rewriting Gemini chat/TTS or the core UI.
- A registry entry is not proof of implementation. Mark features as Planned, Unsupported, Permission Needed, Ready, or Failed based on runtime checks and tests.
- New code cannot safely become active merely because a future capability appears online. Require a reviewed app/module update, signature/integrity checks, compatibility tests, and explicit owner approval for any newly introduced sensitive capability. Do not download and execute arbitrary remote code.

## Shared approval engine

All mutating operations must go through one shared permission/approval gateway:
1. Verify the capability is registered and implemented on this device/OS.
2. Verify the app has the required Android runtime/special permission.
3. Build a human-readable action plan and exact target set.
4. Ask for per-action confirmation. For destructive actions, require a second confirmation that names the item count and deletion consequence.
5. Revalidate the target set after confirmation; if it changed, ask again.
6. Execute only the approved target set.
7. Return success/failure per item and write an audit event.
8. On denial, timeout, cancellation, or error, do not execute or partially broaden scope.

A prior grant (for example, folder access) grants access to that scope; it does not approve file deletion. No hidden/background destructive actions. Voice approval must be unambiguous and read back the exact action before execution. Cloud text alone is never authorization.

## Remote command security

If Mosharrof cloud/AI sends tasks to the phone, pair the Android companion explicitly and use short-lived authenticated sessions, replay protection, per-device revocation, and signed/validated commands. The device displays the final local approval prompt. Never expose long-lived API secrets inside the APK or browser bundle.

## Rollout sequence

1. **Phase 1 — safe settings bridge:** current PR adds OS-owned settings shortcuts and device metadata; verify the APK build and real device before release.
2. **Phase 2 — approval foundation:** shared action schema, local approval UI, audit events, cancellation, capability status model, and fail-closed tests.
3. **Phase 3 — alarms/calendar:** user-mediated alarm/timer and calendar event creation with explicit preview, timezone/recurrence tests, and verifiable hand-off results.
4. **Phase 4 — SAF files:** owner-selected file/folder access, browse/search/preview across file types, organize/copy/move/rename, collision handling, and approval-gated delete.
5. **Phase 5 — media and duplicate finder:** read-only image/video/audio/document candidate scan, hash verification, review/keeper UI, and approval-gated cleanup.
6. **Phase 6 — app control:** installed-app visibility within Android limits, launch, App Info, notification/battery/permission settings, and user-mediated uninstall for ordinary apps; system-app uninstall permanently blocked.
7. **Phase 7 — device health and security:** storage/memory/battery diagnostics, supported performance actions, and honest malware-scan integrations.
8. **Phase 8 — secure orchestration and adapters:** authenticated phone pairing, runtime capability probing, and local confirmation for every cloud-originated mutating task.

Each phase must be an isolated PR, test suite, APK build, device test, rollback artifact, and deployment/health check. Do not merge a phase whose capabilities are only represented in the UI or registry without a working implementation.

## Acceptance criteria for full release

- Every mutating action shows a clear preview and explicit approval.
- Deny/cancel leaves state unchanged.
- Duplicate detection never deletes automatically and never relies on filenames alone.
- System/preinstalled app uninstall is blocked in UI, coordinator, and native layer.
- No capability is shown as available unless the current device/API actually supports it.
- File access remains inside owner-granted URI scopes.
- Alarms/calendar actions accurately report whether they were completed or handed off to the system app.
- Malware scanning claims are backed by a real scanner result; no unsupported "virus removed" claims.
- RAM is not described as physically increased; resource recommendations use supported measurements.
- Future adapters are versioned, reviewed, integrity-checked, and cannot silently activate arbitrary remote code.
- All errors and partial results are visible; no silent success.
- Gemini chat/TTS remains regression-tested and unchanged by device-control work.
- Unit/contract tests, Android APK CI, and real-device smoke tests pass before rollout.
