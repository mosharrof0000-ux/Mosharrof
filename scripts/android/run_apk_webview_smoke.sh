#!/usr/bin/env bash
set -euo pipefail

mkdir -p artifacts/apk-webview-chat
trap 'status=$?; echo "APK WebView smoke failed with exit $status; collecting emulator diagnostics."; adb logcat -d -t 3000 > artifacts/apk-webview-chat/logcat.txt 2>&1 || true; adb shell cat /proc/net/unix > artifacts/apk-webview-chat/unix-sockets.txt 2>&1 || true; exit "$status"' ERR

test -s artifacts/apk/app-debug.apk

for attempt in $(seq 1 60); do
  boot="$(timeout 10s adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  if [ "$boot" = "1" ]; then
    break
  fi
  sleep 2
done
test "$(timeout 10s adb shell getprop sys.boot_completed | tr -d '\r')" = "1"

if ! timeout 60s adb install -r artifacts/apk/app-debug.apk; then
  adb logcat -d -t 3000 > artifacts/apk-webview-chat/logcat.txt 2>&1 || true
  exit 1
fi

adb shell pm grant com.mosharrof.ai android.permission.RECORD_AUDIO || true
adb shell pm grant com.mosharrof.ai android.permission.READ_CONTACTS || true
adb shell pm grant com.mosharrof.ai android.permission.CALL_PHONE || true
# The APK is launched with a test-only flag that skips the unrelated voice overlay.
adb shell am start -n com.mosharrof.ai/.MainActivity --ez mosharrof_disable_voice_overlay true
sleep 25

app_pid="$(timeout 10s adb shell pidof com.mosharrof.ai | tr -d '\r' | awk '{print $1}')"
test -n "$app_pid"
socket="webview_devtools_remote_${app_pid}"
unix_sockets=""
for attempt in $(seq 1 45); do
  unix_sockets="$(timeout 10s adb shell cat /proc/net/unix 2>/dev/null | tr -d '\r' || true)"
  if [[ "$unix_sockets" == *"$socket"* ]]; then
    break
  fi
  sleep 2
done
printf '%s\n' "$unix_sockets" > artifacts/apk-webview-chat/unix-sockets-before-cdp.txt
grep -Fq "$socket" artifacts/apk-webview-chat/unix-sockets-before-cdp.txt
echo "WebView CDP socket found for app PID $app_pid"
adb forward --remove tcp:9222 >/dev/null 2>&1 || true
adb forward tcp:9222 "localabstract:$socket"
timeout 45s curl --retry 10 --retry-delay 2 --retry-connrefused http://127.0.0.1:9222/json/version -o artifacts/apk-webview-chat/webview-version.json
timeout 45s curl --retry 10 --retry-delay 2 --retry-connrefused http://127.0.0.1:9222/json/list -o artifacts/apk-webview-chat/webview-targets.json
sleep 10
python scripts/android/apk_webview_real_chat_smoke.py --cdp-endpoint http://127.0.0.1:9222 --output-dir artifacts/apk-webview-chat
