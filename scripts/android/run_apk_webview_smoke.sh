#!/usr/bin/env bash
set -euo pipefail

mkdir -p artifacts/apk-webview-chat
phase=preflight
trap 'status=$?; echo "phase=$phase exit=$status" > artifacts/apk-webview-chat/failure-phase.txt; echo "APK WebView smoke failed in phase $phase; collecting emulator diagnostics."; adb logcat -d -t 3000 > artifacts/apk-webview-chat/logcat.txt 2>&1 || true; adb shell cat /proc/net/unix > artifacts/apk-webview-chat/unix-sockets.txt 2>&1 || true; exit "$status"' ERR

phase=apk_check
test -s artifacts/apk/app-debug.apk

phase=emulator_boot
for attempt in $(seq 1 60); do
  boot="$(timeout 10s adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  if [ "$boot" = "1" ]; then
    break
  fi
  sleep 2
done
test "$(timeout 10s adb shell getprop sys.boot_completed | tr -d '\r')" = "1"

phase=apk_install
if ! timeout 120s adb install -r artifacts/apk/app-debug.apk; then
  adb logcat -d -t 3000 > artifacts/apk-webview-chat/logcat.txt 2>&1 || true
  exit 1
fi

phase=permission_grants
adb shell pm grant com.mosharrof.ai android.permission.RECORD_AUDIO || true
adb shell pm grant com.mosharrof.ai android.permission.READ_CONTACTS || true
adb shell pm grant com.mosharrof.ai android.permission.CALL_PHONE || true
adb shell appops set com.mosharrof.ai SYSTEM_ALERT_WINDOW allow || true
phase=app_launch
timeout 60s adb shell am start -W -n com.mosharrof.ai/.MainActivity
sleep 15

phase=webview_socket
socket=""
for attempt in $(seq 1 30); do
  socket="$(timeout 10s adb shell cat /proc/net/unix 2>/dev/null | tr -d '\r' | grep -o 'webview_devtools_remote_[0-9]*' | head -n 1 || true)"
  if [ -n "$socket" ]; then
    break
  fi
  sleep 2
done
test -n "$socket"
phase=cdp_forward
adb forward tcp:9222 "localabstract:$socket"
timeout 30s curl --retry 10 --retry-delay 2 --retry-connrefused http://127.0.0.1:9222/json/list -o artifacts/apk-webview-chat/webview-targets.json
phase=real_chat
python scripts/android/apk_webview_real_chat_smoke.py --cdp-endpoint http://127.0.0.1:9222 --output-dir artifacts/apk-webview-chat
