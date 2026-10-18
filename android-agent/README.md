# Mosharrof Android Device Control

A separately buildable native Android app focused only on user-directed Android device control. It is isolated from the MOSHARROF AI web/PWA and is intended to connect later through a versioned, permission-gated plugin bridge.

## Product scope

**Included**
- Bengali/English voice-command input through the Android speech-recognition activity; availability depends on the device.
- Text-to-speech result output with explicit speak/stop controls (CI/device verification pending).
- User-confirmed app launch, supported Settings navigation, Back/Home/Notifications/Recent Apps, bounded exact-label UI actions and directional swipe.
- Optional draggable floating shortcut that opens the voice-command flow; it does not silently listen in the background.
- User-triggered screenshot capture, preview, and explicit-consent Gemini Vision analysis.
- User-selected gallery-image analysis through an explicit upload-consent dialog.
- User-selected audio-file analysis (up to 20 MB) through explicit-consent Gemini audio understanding; reviewed Bengali title, multi-topic tags, short idea summary and uncertainty are stored locally by URI.
- User-selected folder classification for images, audio, videos, documents, archives and APKs; duplicate-content scan; previewed media folder organization with copy-size verification before attempting to remove original files.
- Song-topic catalog with multi-label categories including দেহতত্ত্ব, আত্মতত্ত্ব, গুরুতত্ত্ব, প্রেম, ভক্তি, প্রকৃতি, বিরহ and সাধনা ও আত্মঅনুসন্ধান.
- Name/extension-based local file-risk triage for suspicious extensions and double-extension files. This is not a full antivirus engine and cannot prove a file safe.
- User-directed app install flow through Android's package installer / Play Store UI, and uninstall flow through Android's system uninstall screen; final OS confirmation remains required.
- Timer/alarm intents and calendar event drafts, including explicit dates where supported by the parser.
- Local device diagnostics, including battery percentage and charging state, internal-storage capacity, RAM, network, device model, Android version and uptime.
- Android-owned permission screens for Accessibility, overlay, notifications, system settings and battery optimization.
- Local confirmation, cancellation of pending actions, and safety policy checks.

The app does not request camera access for these analysis features. Gallery images and selected audio are uploaded only after a separate confirmation; the user must configure a Gemini key, which is encrypted at rest with Android Keystore. Media organization is limited to the user-selected Storage Access Framework folder and requires confirmation before moving/deleting files. File-risk triage is heuristic, not antivirus.

## Battery and charging

The on-demand diagnostics screen reports the battery percentage and Android-reported charging status (charging, full, not charging or unknown). Android does not permit a normal app to force hardware charging or override the device's power controller. Any future battery-related commands must stay within public Android APIs and explicit OS permissions.

## Build and test

Requirements: Android Studio, JDK 17, Android SDK Platform 35.

From this directory:

```bash
gradle assembleDebug
gradle testDebugUnitTest
```

GitHub Actions is configured to build a debug APK, run JVM unit tests and emulator instrumentation tests, and upload the APK only if all configured steps pass. A debug APK is for testing, not a release-signed production build.

## Current implementation limits

- The local agent is an MVP, not unrestricted control of every app or every device feature.
- Full natural-language analysis of every media item, batch song analysis, precise automatic Bengali title conversion for every dialect/song, and automatic playlist playback are not yet complete.
- General multi-step planning, universal UI element discovery, interruption-aware continuous voice sessions, comprehensive recovery/postcondition verification and physical-device acceptance remain incomplete.
- Android app-specific UI, OEM restrictions, permission gates and user confirmation apply.
- A successful CI build is not a substitute for installation and acceptance testing on a physical Android device.
- The plugin bridge is a local contract only; authenticated phone pairing and MOSHARROF's remote plugin transport are not connected yet.
- The module currently lives in the MOSHARROF repository on a feature branch; a separate GitHub repository has not been created.

## Safety model

The device owner enables Accessibility and other special capabilities explicitly in Android Settings. Externally visible or destructive actions require confirmation. The app must not bypass Android permission dialogs, read protected app-private data, store passwords/OTPs/payment credentials by default, or execute arbitrary shell/root commands.

The existing MOSHARROF main branch and Live Pages must remain unchanged until a separate reviewed integration PR is approved.
