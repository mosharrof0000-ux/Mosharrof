# Mosharrof Android Autonomous Agent

Native Android Studio project foundation for a user-directed automation agent. This module is separate from the existing MOSHARROF AI web/PWA.

## Build

Requirements: Android Studio with JDK 17 and Android SDK Platform 35.

From this directory, run:

```bash
gradle assembleDebug
gradle testDebugUnitTest
```

Open `android-agent/` as a project in Android Studio if you prefer the IDE. The CI workflow uses Gradle 8.9 and builds the debug APK.

## Current implementation status

- [x] Standalone Kotlin Android app module and manifest
- [x] Explicit user-facing Accessibility Settings entry point
- [x] Accessibility event listener and bounded UI node-count inspection
- [x] CI build/test workflow
- [ ] Intent parser and task planner
- [ ] Explicit action policy and per-task confirmation UI
- [ ] Semantic node locator and safe gesture executor
- [ ] Appium/UiAutomator2 device test suite
- [ ] Local vision model adapter and model benchmark
- [ ] Speech input/output and interruption-aware task updates
- [ ] Encrypted local memory and opt-in retrieval
- [ ] Release signing and real-device acceptance test

This is a foundation, not a claim that full autonomous execution is complete. The current service inspects accessibility events only; it does not click controls or execute shell/root commands.

## Safety model

The service is off until the device owner enables it in Android Settings. User-directed tasks only. Ask for confirmation before actions with external side effects (sending, deleting, purchasing, posting, changing security settings, or sharing data). Never store passwords, OTPs, payment credentials, or arbitrary screen contents by default. Do not bypass Android permission dialogs or security boundaries.

Root/Magisk/LSPosed/ADB shell support is not enabled by default. If added later, it must be an optional, separately reviewed capability with visible status, scoped commands, audit logs, and explicit opt-in.
