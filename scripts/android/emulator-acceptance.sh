#!/usr/bin/env bash
set -euo pipefail
APK="android/app/build/outputs/apk/debug/app-debug.apk"
PKG="com.mosharrof.ai"
ACTIVITY="$PKG/.MainActivity"
test -s "$APK"

capture_state() {
  local label="$1"
  adb shell am start -W -n "$ACTIVITY"
  sleep 8
  adb shell dumpsys activity activities > "/tmp/mosharrof-activities-$label.txt"
  grep -q "$PKG" "/tmp/mosharrof-activities-$label.txt"
  adb shell uiautomator dump "/sdcard/mosharrof-window-$label.xml"
  adb pull "/sdcard/mosharrof-window-$label.xml" "mosharrof-window-$label.xml"
  adb shell screencap -p "/sdcard/mosharrof-$label.png"
  adb pull "/sdcard/mosharrof-$label.png" "mosharrof-$label.png"
  test -s "mosharrof-window-$label.xml"
  test -s "mosharrof-$label.png"
}

# Emulator is disposable CI state: remove any prior copy for a deterministic clean install.
adb uninstall "$PKG" >/dev/null 2>&1 || true
adb install "$APK"
adb shell pm grant "$PKG" android.permission.RECORD_AUDIO || true
adb shell pm grant "$PKG" android.permission.READ_CONTACTS || true
adb shell pm grant "$PKG" android.permission.CALL_PHONE || true
adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS || true
capture_state "fresh-install"

# Exercise Android's in-place replacement path with the built APK. A future release
# job should replace this same-build check with previous-release APK -> candidate APK.
adb install -r "$APK"
capture_state "in-place-update"

# Verify uninstall removes the package, then reinstall and relaunch it.
adb uninstall "$PKG"
if adb shell pm path "$PKG" 2>/dev/null | grep -q 'package:'; then
  echo "Uninstall verification failed: package still present" >&2
  exit 1
fi
adb install "$APK"
capture_state "reinstall"
echo "Android Emulator lifecycle acceptance: fresh install, replacement, uninstall, reinstall and UI evidence PASS"
