# Mosharrof Android Autonomous Agent

Native Android Studio project for a user-directed automation agent, isolated from the existing MOSHARROF AI web/PWA.

## Build and test

Requirements: Android Studio, JDK 17, Android SDK Platform 35.

From this directory, run:

```bash
gradle assembleDebug
gradle testDebugUnitTest
```

The GitHub Actions workflow uses Gradle 8.9 and publishes the debug APK as a workflow artifact.

## Implementation status

- [x] Standalone Kotlin Android app and manifest
- [x] User-facing Accessibility Settings entry point
- [x] Bounded, read-only accessibility event inspection
- [x] Bengali/English command parser with typed intents
- [x] Action policy with deny/confirmation decisions and unit tests
- [x] CI debug APK build and JVM unit tests
- [ ] Map parsed intents to installed-app launchers and safe task execution
- [ ] Per-task confirmation UI and visible task progress/cancel controls
- [ ] Semantic node locator and bounded gesture executor
- [ ] Appium/UiAutomator2 device tests and real-device acceptance
- [ ] Speech input/output, interruption, and task status updates
- [ ] Local vision model adapter and benchmark
- [ ] Encrypted, opt-in local memory/retrieval
- [ ] Release signing and distribution

This is an incremental foundation, not a completed fully autonomous agent. The parser only classifies text; it does not perform actions. The accessibility service currently inspects events and does not click controls or execute shell/root commands.

## Safety model

The service remains off until the device owner enables it in Android Settings. Tasks must be user-directed. Ask for confirmation before externally visible or destructive actions (sending, deleting, purchasing, posting, changing security settings, or sharing data). Never store passwords, OTPs, payment credentials, or arbitrary screen contents by default. Do not bypass Android permission dialogs or platform security boundaries.

Root/Magisk/LSPosed/ADB shell support is not enabled by default. Any later support must be optional, separately reviewed, visibly enabled, narrowly scoped, audited, and explicitly opted into.
