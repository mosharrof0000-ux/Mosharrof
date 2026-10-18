# Mosharrof Android Autonomous Agent

Native Android Studio project for a user-directed automation agent, isolated from the existing MOSHARROF AI web/PWA.

## Build and test

Requirements: Android Studio, JDK 17, Android SDK Platform 35.

From this directory, run:

```bash
gradle assembleDebug
gradle testDebugUnitTest
```

GitHub Actions builds a debug APK and publishes it as a workflow artifact.

## Implemented in this milestone

- [x] Standalone Kotlin Android app and manifest
- [x] User-facing Accessibility Settings entry point
- [x] Capability access hub linking to Android Accessibility, all-files, usage-access, battery-optimization and app-permission settings (user grants each access explicitly; latest CI/device verification pending)
- [x] Bounded, read-only accessibility event inspection
- [x] Explicit current-screen snapshot: package, bounded node count, and up to 40 short visible labels
- [x] Deterministic Bengali/English text intent parsing
- [x] Confirmed call/SMS intent support: uses CALL_PHONE/SEND_SMS only when the user has granted them; otherwise opens the Android Dialer/SMS draft. Outbound SMS is submitted only after the app's confirmation button; carrier delivery is not guaranteed.
- [x] Common Bengali app aliases and installed-app discovery
- [x] Confirmed Back/Home/Notifications/Recent Apps commands; deterministic parser and policy tests added (emulator/physical-device verification pending)
- [x] On-demand read-only battery, internal storage, system RAM/low-memory warning, network transport/connectivity, device model, Android version and uptime diagnostics displayed locally (physical-device verification pending)
- [x] User-selected folder inventory and bounded SHA-256 duplicate scan; duplicates are only deleted after a separate confirmation (CI/device verification pending)
- [x] User-triggered screen screenshot capture, in-app preview, and transient UI-label analysis
- [x] Explicitly opt-in Gemini Vision screenshot analysis; the API key is encrypted at rest with Android Keystore and the image is uploaded only after a separate user tap. Structured next-command suggestions are passed back through the local planner and confirmation gate (CI/live API/device verification pending)
- [x] Initial Android permission center for runtime and special app-access permissions, with grant-status review (latest CI and device/OEM verification pending)
- [x] HTTPS Gemini Vision API adapter for explicit screenshot analysis; other chat/planner provider integration and failover are not yet connected
- [x] Voice command input through Android's speech-recognition activity (availability depends on device)
- [ ] Result readout using Android TextToSpeech with explicit speak/stop controls (code added; CI/device verification pending)
- [x] Visible cancel button clears pending app/settings/tap plans and cancels an armed screen inspection (not a general multi-step executor cancel)
- [x] Confirmation step before launching a selected app
- [x] Policy gate for allowlisted app launch and unit tests
- [ ] Explicit one-shot swipe/scroll (up/down/left/right) in a named installed app; code and parser tests added, latest CI and physical-device verification pending
- [x] CI debug APK build and JVM unit tests

## Not yet complete

- [x] AI-assisted normalization fallback for unsupported local commands through the existing MOSHARROF chat Worker; every normalized command is revalidated by the local planner and requires confirmation (CI/live endpoint verification pending)
- [ ] General natural-language task planning across arbitrary apps (AI Vision suggestions are constrained single-command proposals, not a general multi-step executor)
- [ ] General semantic node locator and bounded UI action executor (exact-label tap, one-shot swipe, confirmed global navigation and focused-field text insertion are initial actions; arbitrary UI interaction is not enabled)
- [ ] Per-task progress, interrupt, cancel, deadlines, postcondition verification and recovery (app launch and tap/swipe outcomes now have bounded verification; current cancel still clears pending/armed actions rather than a general running workflow)
- [ ] Safe Settings command routing and system-setting confirmation (Wi-Fi, Bluetooth, Location, Display, Sound, Battery Saver, Notifications and Application Settings routes are coded; latest CI and OEM/physical-device verification pending)
- [ ] Appium/UiAutomator2 device tests and real-device acceptance
- [ ] Speech output and continuous, interruption-aware voice session
- [ ] Local vision model adapter and on-device benchmark
- [ ] Encrypted, opt-in local memory/retrieval
- [x] Initial capability/permission center for Accessibility, usage access, all-files access, microphone, contacts, calendar, media, notifications and exact-alarm access; user grants remain controlled by Android.
- [ ] Full permission registry with risk tiers, audit/revocation and capability-by-capability device validation
- [ ] Release signing, installation validation and distribution

This milestone is **not** a completed fully autonomous agent. Current executable scope is an MVP: resolve an explicit installed-app name and request Android to launch it after confirmation; one exact-label tap, directional swipe, global navigation action, or user-approved text insertion into the named app's focused editable field can be proposed and confirmed. Text insertion never presses Send/Submit. These UI actions are bounded and still require CI and physical-device verification. Screen inspection is read-only and user-triggered. A captured screenshot stays in app memory unless the user separately confirms sending it to Gemini Vision; the API key is encrypted at rest with Android Keystore. Speech recognition relies on a compatible recognizer installed/configured on the device. The Accessibility service does not click arbitrary controls, read all app data, or execute shell/root commands. A successful CI build is not a substitute for installation and acceptance testing on a physical Android device.

## Capability and permission center\n\nUse “ডিভাইসের ক্ষমতা ও অনুমতি পরিচালনা করুন” in the app to inspect the initial capability inventory and open Android-owned permission screens. A granted permission means the OS permits that category; it does not mean every feature in that category has been implemented or tested. The inventory is a first step, not a claim of unrestricted device control.\n\n## Safety model

The service remains off until the device owner enables it in Android Settings. Tasks must be user-directed. Ask for confirmation before externally visible or destructive actions (sending, deleting, purchasing, posting, changing security settings, or sharing data). Never store passwords, OTPs, payment credentials, or arbitrary screen contents by default. Do not bypass Android permission dialogs or platform security boundaries.

Root/Magisk/LSPosed and in-app ADB shell execution are not enabled. An optional Device Admin receiver and ADB Device Owner provisioning command are exposed; the command must be run by the owner on a trusted host and does not grant unrestricted control by itself.
