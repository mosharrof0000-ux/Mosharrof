# MOSHARROF Android Autonomous Agent — Master Feature Checklist

This is the single source of truth for the Android device-control feature set requested across prior MOSHARROF conversations. It is a tracked implementation checklist, not proof that unchecked features work. Status must change only with code/tests/evidence.

## Operating rules (mandatory)
- [x] Separate native Android app under `android-agent/`; keep the existing web/PWA and Gemini/voice integrations intact.
- [x] Work on a feature branch; never push directly to `main`.
- [x] Require a preview/consent for consequential device actions; enforce Android permission boundaries and fail closed on ambiguity.
- [x] Keep files small, separate components by responsibility, test each change, preserve a rollback path.
- [x] Complete all gates before merge: unit tests, emulator tests, security/manifest review, APK artifact, installation and acceptance on a physical Android device.
- [x] Report evidence and limitations; never call a feature complete from a build alone.

## A. Natural-language and voice interaction
- [x] Bengali/English explicit app-launch commands.
- [x] Speech-to-text through the device speech-recognition activity (device service availability varies).
- [x] Confirmation before app launch and supported UI tap.
- [x] Bounded command length; reject ambiguous/unsupported commands.
- [x] Common Bengali app aliases.
- [ ] Continuous hands-free session, wake/interrupt/stop, visible microphone state and robust cancellation.
- [x] Text-to-speech result readout — code and speak/stop UI are added in this work branch; verify via CI and a physical device.
- [x] AI-assisted command normalization through the existing MOSHARROF chat Worker for locally unsupported requests; normalized output is re-parsed by the deterministic local planner and still requires the usual confirmation. CI/live endpoint verification pending.
- [ ] Connect the agent to MOSHARROF AI's full conversational engine and multi-step planner without replacing or breaking Gemini or provider fallback.
- [ ] Optional configurable Bengali voice, speed, voice style and speak/stop controls.

## B. App and screen control
- [x] Discover launchable installed apps and open a specifically resolved app after confirmation.
- [x] User-armed, bounded, read-only accessibility screen snapshot.
- [x] Exact visible-label tap with ambiguity rejection and confirmation.
- [x] Confirmed global navigation commands for Back, Home, Notifications, and Recent Apps; deterministic parser and approval-policy tests added. Emulator/physical-device verification pending.
- [ ] Semantic UI actions beyond the current bounded exact-label tap, one-shot directional swipe, and global navigation: safe text entry, focus handling, and per-step result verification; each individually reviewed and confirmed.
- [ ] Task plans with multiple steps, visible step-by-step progress, stop/cancel and deadlines.
- [x] Verify app-launch foreground package and poll confirmed tap/swipe outcomes with a bounded timeout; report uncertainty instead of claiming success. Full postcondition checks for every action remain pending.
- [ ] Bounded retry/re-plan and recovery when an expected control is absent; stop safely when uncertain.
- [x] User-toggleable floating voice control using Android's Accessibility overlay (draggable, edge-snapping, long-press expand/collapse, close control, voice launch); requires the user to enable Accessibility. CI and physical-device interaction/position persistence verification pending.
- [ ] Device/OEM and screen-size adaptation (small phones, tablets, desktop/TV contexts where applicable).

## C. Android system settings and device health
- [x] Open Android Settings, Wi-Fi, Bluetooth and Location settings pages; user makes changes in Android UI.
- [ ] Additional Settings routes are coded for display, sound, battery saver, notifications and apps; verify in latest CI and on OEM devices. Accessibility Settings is already available; OEM fallback tests remain.
- [x] On-demand, read-only diagnostics for battery percentage/charging state, internal storage, system RAM/low-memory warning, network transport/connectivity, device model, Android version, and uptime; physical-device validation and deeper performance measurements remain pending.
- [ ] Safe performance/storage assistance with before/after measurement and explicit confirmation for changes.
- [x] Confirmed Dialer, Clock timer and Calendar handoff; with CALL_PHONE/SEND_SMS already granted, a separately confirmed call/SMS action can use Android telephony APIs; without grants it falls back to Dialer/SMS draft. SMS delivery is not guaranteed. CI/device verification pending.
- [ ] No silent changes to protected settings; never bypass OS permission dialogs or lock screen.

## D. Files, media, apps and privacy
- [x] User-selected folder via Storage Access Framework; bounded local inventory and duplicate hashing are wired into the app (CI/device verification pending).
- [x] Duplicate detection with a review list; deletion requires a separate explicit confirmation and is never automatic (CI/device verification pending).
- [ ] Media/photo/video/audio management with scoped permissions and user-selected targets.
- [ ] App info, launch, supported app settings and uninstall handoff through Android system UI; no silent uninstall or app-data wipe.
- [ ] Suspicious-file guidance and safe scanning integration; do not claim antivirus protection without an actual scanner.
- [ ] Opt-in encrypted local preferences/task summaries, user-visible review and delete; never store passwords, OTPs, payment data or full screen contents by default.

## E. Vision, memory and AI planning
- [x] Typed action model and deterministic policy gate; arbitrary shell commands are not representable.
- [x] User-triggered Android Accessibility screenshot capture and in-app preview, with transient visible-label/node analysis; screenshots are not saved automatically. Build/device verification pending.
- [x] Explicit opt-in screenshot upload directly to Google Gemini Vision over HTTPS; bounded JPEG size, API key encrypted at rest with Android Keystore, and image upload requires a separate user confirmation. CI/live API/device verification pending.
- [ ] Measure vision latency/accuracy and connect semantic screenshot results to the planner/action loop; image coordinates only as a last resort with revalidation.
- [x] AI Vision returns structured screen summary, visible controls, uncertainty, and one constrained reversible next-command suggestion; a separate button passes it through the local deterministic planner and existing confirmation policy. The model cannot directly execute actions.
- [ ] Bounded planner that proposes typed actions, not executable shell or unrestricted code.
- [ ] Optional local retrieval/memory, encrypted and opt-in.
- [ ] AI provider failover and connection to existing MOSHARROF/Gemini services, with no hard-coded secrets and clear offline fallback.

## F. Safety, permissions and audit
- [x] Accessibility is off until the owner explicitly enables it.
- [x] High-risk visible labels (send/delete/pay/share/post/confirm/install, etc.) are rejected in the current tap planner.
- [x] Per-task action budget and package allowlist policy primitive.
- [x] Initial permission center for Accessibility, overlay, usage access, all-files access, microphone, contacts, calendar, shared media, notification permission, notification-listener access and exact-alarm special access; displays OS grant state and opens Android-owned permission/settings screens.
- [x] Optional NotificationListenerService with explicit Android notification-access grant; displays a bounded recent-notification snapshot in memory only, with no persistence/upload. Physical-device privacy and lifecycle validation pending.
- [x] Expanded permission inventory for camera, location, Bluetooth, phone/SMS/call-log, notification listener, system-settings access and battery optimization; OS grants remain owner-controlled. Full per-action registry, audit outcomes, revocation handling and OEM fallbacks remain pending.
- [ ] Clear stop-all control, cancellation on service interruption, bounded deadlines and no hidden background actions.
- [ ] Protect sensitive UI text; do not persist screenshots or arbitrary screen data by default.
- [ ] Security review for exported components, Accessibility disclosures, overlay, microphone and file permissions.

## G. Build, delivery and real-device acceptance
- [x] Isolated Kotlin Android Studio project and debug APK CI workflow.
- [x] JVM unit-test suite and emulator instrumentation smoke-test target.
- [x] Latest CI run fully green with artifact from the same commit.
- [ ] Install APK on the target Android phone and verify app launch, speech input/output, permissions, app launch, screen snapshot, safe UI tap, cancel/failure behavior.
- [ ] Test denied permissions, missing speech service, duplicate labels, stale screens, app crash and OEM Settings intent fallbacks.
- [ ] Release signing and distribution workflow; keep debug builds clearly labelled.
- [ ] PR review, passing required checks, protected auto-merge only when eligible, deployment/health check where relevant, rollback instructions.

## Current honest status
The project is an incremental MVP, not yet a fully autonomous phone-control system. Checked boxes describe code already present in the feature branch; unchecked boxes are outstanding. CI and a debug APK do not prove real-device acceptance. This checklist must be updated alongside implementation and test evidence.
