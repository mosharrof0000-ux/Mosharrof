# MOSHARROF Android Device Control — Phase 1

## What this phase does

The Android APK build packages a small Capacitor native plugin named `DeviceControl`. The existing web interface adds a Bengali **Android ডিভাইস নিয়ন্ত্রণ** group to the right-side menu.

Supported actions:

- Read device manufacturer, model, and Android version.
- Open Android-owned Wi-Fi, Bluetooth, display, sound, battery, location, and app settings pages.

These actions are **user-mediated**: MOSHARROF opens the operating-system settings page, and the user chooses the change there. The website-only/PWA version explains that native controls require the APK.

## Explicit limits

This phase does **not** silently toggle radios, change brightness, force-stop apps, read installed-app inventories, uninstall apps, clear app data, bypass the lock screen, or use Accessibility Services/Device Administrator. It does not request broad system-write permissions. Android OEMs may omit or rename individual settings pages.

This is the first device-control slice, not full remote phone control. More powerful actions must be added one by one with Android permission checks, a clear preview, explicit user approval, audit records, and tests.

## Build and verification

The Android workflow copies `native/android/DeviceControlPlugin.java` into the generated Capacitor Android project, registers the plugin in `MainActivity`, runs `scripts/test_device_control_contract.mjs`, builds the debug APK, validates the APK archive, and uploads it as a workflow artifact.

The automated contract test is a static safety check. A successful APK build does not prove device behavior on every OEM; install the artifact on a test phone and verify each settings action before release.

## Next device-control phases

1. Establish a native app ↔ Mosharrof backend pairing/authentication contract before allowing commands from outside the phone.
2. Add status/read-only diagnostics first, with least-privilege Android APIs.
3. Add only documented Android-supported actions, each with a per-action permission and approval gate.
4. Test on a real Android device, record results, and preserve a rollback artifact.
