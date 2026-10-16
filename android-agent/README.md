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
- [x] Bounded, read-only accessibility event inspection
- [x] Explicit current-screen snapshot: package, bounded node count, and up to 40 short visible labels
- [x] Deterministic Bengali/English text intent parsing
- [x] Common Bengali app aliases and installed-app discovery
- [x] Voice command input through Android's speech-recognition activity (availability depends on device)
- [ ] Result readout using Android TextToSpeech with explicit speak/stop controls (code added; CI/device verification pending)
- [x] Confirmation step before launching a selected app
- [x] Policy gate for allowlisted app launch and unit tests
- [x] CI debug APK build and JVM unit tests

## Not yet complete

- [ ] General natural-language task planning across arbitrary apps
- [ ] Semantic node locator and bounded UI action executor
- [ ] Per-task progress, interrupt, cancel, postcondition verification and recovery
- [ ] Safe Settings command routing and system-setting confirmation
- [ ] Appium/UiAutomator2 device tests and real-device acceptance
- [ ] Speech output and continuous, interruption-aware voice session
- [ ] Local vision model adapter and on-device benchmark
- [ ] Encrypted, opt-in local memory/retrieval
- [ ] Release signing, installation validation and distribution

This milestone is **not** a completed fully autonomous agent. Current executable scope is intentionally narrow: resolve an explicit installed-app name, ask the user to confirm, then request Android to launch it. Screen inspection is read-only and only runs when the user taps the inspection button; results stay in the UI and are not persisted. Speech recognition relies on a compatible recognizer installed/configured on the device. The Accessibility service does not click arbitrary controls, read all app data, or execute shell/root commands. A successful CI build is not a substitute for installation and acceptance testing on a physical Android device.

## Safety model

The service remains off until the device owner enables it in Android Settings. Tasks must be user-directed. Ask for confirmation before externally visible or destructive actions (sending, deleting, purchasing, posting, changing security settings, or sharing data). Never store passwords, OTPs, payment credentials, or arbitrary screen contents by default. Do not bypass Android permission dialogs or platform security boundaries.

Root/Magisk/LSPosed/ADB shell support is not enabled by default. Any later support must be optional, separately reviewed, visibly enabled, narrowly scoped, audited, and explicitly opted into.
