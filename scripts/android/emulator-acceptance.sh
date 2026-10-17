#!/usr/bin/env bash
set -euo pipefail
APK="android/app/build/outputs/apk/debug/app-debug.apk"
test -s "$APK"
adb install "$APK"
# Grant only standard runtime permissions in the isolated emulator; special permissions
# (overlay and Accessibility) remain user-mediated and are tested separately.
adb shell pm grant com.mosharrof.ai android.permission.RECORD_AUDIO || true
adb shell pm grant com.mosharrof.ai android.permission.READ_CONTACTS || true
adb shell pm grant com.mosharrof.ai android.permission.CALL_PHONE || true
adb shell pm grant com.mosharrof.ai android.permission.POST_NOTIFICATIONS || true
adb shell am start -W -n com.mosharrof.ai/.MainActivity
sleep 12
adb shell dumpsys activity activities > /tmp/mosharrof-activities.txt
grep -q 'com.mosharrof.ai' /tmp/mosharrof-activities.txt
adb shell uiautomator dump /sdcard/mosharrof-window.xml
adb pull /sdcard/mosharrof-window.xml mosharrof-window.xml
adb shell screencap -p /sdcard/mosharrof-emulator.png
adb pull /sdcard/mosharrof-emulator.png mosharrof-emulator.png
test -s mosharrof-window.xml
test -s mosharrof-emulator.png
echo "Android Emulator install/launch/UI hierarchy/screenshot: PASS"
