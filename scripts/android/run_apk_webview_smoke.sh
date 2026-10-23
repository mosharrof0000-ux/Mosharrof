#!/usr/bin/env bash
set -euo pipefail

mkdir -p artifacts/apk-webview-chat
trap 'status=$?; echo "APK WebView smoke failed with exit $status; collecting emulator diagnostics."; adb logcat -d -t 3000 > artifacts/apk-webview-chat/logcat.txt 2>&1 || true; adb shell cat /proc/net/unix > artifacts/apk-webview-chat/unix-sockets.txt 2>&1 || true; exit "$status"' ERR

test -s artifacts/apk/app-debug.apk

QA_STRATEGY="${QA_STRATEGY:-direct}"
case "$QA_STRATEGY" in
  direct) CHAT_TIMEOUT_MS=90000 ;;
  recover) CHAT_TIMEOUT_MS=90000 ;;
  retry) CHAT_TIMEOUT_MS=180000 ;;
  *) echo "Unknown QA_STRATEGY: $QA_STRATEGY"; exit 2 ;;
esac

# Keep ADB startup recovery isolated so this smoke runner stays within file-growth policy.
bash scripts/android/ensure-adb-daemon.sh
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
adb shell appops set com.mosharrof.ai SYSTEM_ALERT_WINDOW allow || true
if [ "$QA_STRATEGY" = "recover" ]; then
  adb shell am force-stop com.mosharrof.ai || true
fi
adb shell am start -n com.mosharrof.ai/.MainActivity
if [ "$QA_STRATEGY" = "recover" ]; then sleep 25; else sleep 15; fi

socket=""
for attempt in $(seq 1 30); do
  socket="$(timeout 10s adb shell cat /proc/net/unix 2>/dev/null | tr -d '\r' | grep -o 'webview_devtools_remote_[0-9]*' | head -n 1 || true)"
  if [ -n "$socket" ]; then
    break
  fi
  sleep 2
done
test -n "$socket"
adb forward tcp:9222 "localabstract:$socket"
timeout 30s curl --retry 10 --retry-delay 2 --retry-connrefused http://127.0.0.1:9222/json/list -o artifacts/apk-webview-chat/webview-targets.json
python scripts/android/apk_webview_real_chat_smoke.py --cdp-endpoint http://127.0.0.1:9222 --output-dir artifacts/apk-webview-chat --timeout-ms "$CHAT_TIMEOUT_MS"
