# Android Settings Hub — capability and safety boundary

## What this change adds

The native Capacitor `DeviceControl` bridge and the Android navigation UI provide shortcuts to these Android-owned settings pages:

- Connections: Wi-Fi, Bluetooth, VPN, NFC.
- Device: display, sound, battery, storage, battery optimization, public model/Android version.
- Privacy and safety: location, privacy, security, notifications, accessibility, app overlay permission, MOSHARROF App Info.
- System: installed apps, default apps, date/time, language/region, keyboard/input, account/sync settings.

Every native action is a settings-page launch, not a silent setting mutation. Android or the device manufacturer may not provide every intent on every Android version; the bridge catches unsupported intents and returns a failure instead of claiming success. The user completes and confirms changes in the system UI.

## What this does not mean

This is a broader settings hub, not yet universal device automation. It does not silently toggle Wi-Fi/Bluetooth, grant permissions, enable Accessibility, read other apps' private data, send messages, place calls, delete files, or operate arbitrary apps. Those capabilities require separate narrow implementations, runtime permissions, clear per-action approval, independent verification, and device-level acceptance testing. An app cannot guarantee every natural-language instruction is executable.

## Acceptance checks

- The native bridge must expose every settings method referenced by the UI.
- UI must clearly say that changes are performed by the user in Android Settings.
- Web/PWA mode must fail clearly rather than pretending to control the device.
- Build the APK and run the device-control contract test before release.
- Physical-device acceptance is still required to confirm manufacturer-specific Settings intents.
