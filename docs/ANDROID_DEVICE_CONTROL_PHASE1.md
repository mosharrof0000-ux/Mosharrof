# MOSHARROF Android Device Control — Phase 1

## What is implemented

The Android APK packages a Capacitor plugin named `DeviceControl`. The right-side menu provides device information and shortcuts to Android-owned Wi-Fi, Bluetooth, display, sound, battery, location, and application settings.

These actions are **user-mediated**: MOSHARROF opens the operating-system settings page, and the owner makes any change there. The website/PWA cannot directly change phone settings and displays that limitation.

## Explicit limits

This phase does not silently toggle radios, change brightness, force-stop apps, inspect private app inventories, uninstall apps, clear app data, bypass the lock screen, or use Accessibility Services/Device Administrator. It does not request broad system-write permissions. Android OEMs may omit or rename individual settings pages.

This is a first device-control slice, not full remote phone control. More powerful actions must be added individually with Android permission checks, a clear preview, explicit approval, audit records, and tests.

## Build and verification

The Android workflow copies the native plugin into the generated Capacitor project, registers it in `MainActivity`, runs `scripts/test_device_control_contract.mjs`, builds the debug APK, validates the archive, and uploads the artifact.

Automated contract tests and a successful APK build do not prove behavior on every OEM. Physical-device testing is still required before release.
