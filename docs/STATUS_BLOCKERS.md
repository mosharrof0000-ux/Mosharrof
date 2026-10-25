# Current Blockers

- **Physical Device Access:** Android APK WebView real-chat verification requires a physical device. Emulator testing is insufficient for full verification of Accessibility and Settings intents.
- **APK Build:** A fresh APK build from the latest main branch is required to verify the current state of the Android agent.
- **Permission Gating:** PR #801 (Android app install/uninstall) is clean but requires manual verification of permission-gated behavior on a physical device before it can be safely merged.