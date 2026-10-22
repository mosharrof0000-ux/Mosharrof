#!/usr/bin/env bash
# Shared steps for the installed-APK WebView smoke test.
# Keep the entrypoint small; the existing size gate remains unchanged.
set -euo pipefail

apk_webview_smoke_run() {
  mkdir -p artifacts/apk-webview-chat
  trap 'status=$?; echo "APK WebView smoke failed with exit $status; collecting emulator diagnostics."; adb logcat -d -t 3000 > artifacts/apk-webview-chat/logcat.txt 2>&1 || true; adb shell cat /proc/net/unix > artifacts/apk-webview-chat/unix-sockets.txt 2>&1 || true; adb devices -l > artifacts/apk-webview-chat/adb-devices.txt 2>&1 || true; exit "$status"' ERR

  test -s artifacts/apk/app-debug.apk
  apk_webview_wait_for_framework
  apk_webview_install_and_launch
  apk_webview_connect_and_test_chat
}

apk_webview_wait_for_framework() {
  # Boot completion alone does not guarantee that framework services are ready.
  adb start-server
  local device="emulator-5554" online=false state boot boot_ready=false
  local input_service package_probe settings_probe framework_ready=false
  for attempt in $(seq 1 90); do
    state="$(adb devices | awk -v d="$device" '$1 == d {print $2; exit}')"
    if [ "$state" = "device" ]; then online=true; break; fi
    if [ "$state" = "offline" ]; then adb reconnect "$device" >/dev/null 2>&1 || true; fi
    sleep 2
  done
  if [ "$online" != true ]; then
    adb devices -l || true
    echo "Emulator ADB transport did not become online within 180 seconds." >&2
    return 1
  fi

  for attempt in $(seq 1 90); do
    boot="$(timeout 10s adb -s "$device" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
    if [ "$boot" = "1" ]; then boot_ready=true; break; fi
    sleep 2
  done
  if [ "$boot_ready" != true ]; then
    echo "Android framework did not report boot completion within 180 seconds." >&2
    return 1
  fi

  for attempt in $(seq 1 90); do
    input_service="$(timeout 8s adb -s "$device" shell service check input 2>/dev/null | tr -d '\r' || true)"
    package_probe="$(timeout 8s adb -s "$device" shell pm list packages android 2>/dev/null | tr -d '\r' || true)"
    settings_probe="$(timeout 8s adb -s "$device" shell settings get global airplane_mode_on 2>/dev/null | tr -d '\r' || true)"
    if [[ "$input_service" == *"found"* ]] && [[ "$package_probe" == *"package:android"* ]] && [[ "$settings_probe" == "0" || "$settings_probe" == "1" ]]; then
      framework_ready=true
      break
    fi
    sleep 2
  done
  if [ "$framework_ready" != true ]; then
    adb -s "$device" shell service list > artifacts/apk-webview-chat/services.txt 2>&1 || true
    echo "Android booted but input/package/settings services were not all ready within 180 seconds." >&2
    return 1
  fi
}

apk_webview_install_and_launch() {
  local device="emulator-5554"
  if ! timeout 60s adb -s "$device" install -r artifacts/apk/app-debug.apk; then
    adb logcat -d -t 3000 > artifacts/apk-webview-chat/logcat.txt 2>&1 || true
    return 1
  fi
  adb -s "$device" shell pm grant com.mosharrof.ai android.permission.RECORD_AUDIO || true
  adb -s "$device" shell pm grant com.mosharrof.ai android.permission.READ_CONTACTS || true
  adb -s "$device" shell pm grant com.mosharrof.ai android.permission.CALL_PHONE || true
  adb -s "$device" shell appops set com.mosharrof.ai SYSTEM_ALERT_WINDOW allow || true
  adb -s "$device" shell am start -n com.mosharrof.ai/.MainActivity
  sleep 15
}

apk_webview_connect_and_test_chat() {
  local device="emulator-5554" socket=""
  for attempt in $(seq 1 30); do
    socket="$(timeout 10s adb -s "$device" shell cat /proc/net/unix 2>/dev/null | tr -d '\r' | grep -o 'webview_devtools_remote_[0-9]*' | head -n 1 || true)"
    if [ -n "$socket" ]; then break; fi
    sleep 2
  done
  test -n "$socket"
  adb -s "$device" forward tcp:9222 "localabstract:$socket"
  timeout 30s curl --retry 10 --retry-delay 2 --retry-connrefused http://127.0.0.1:9222/json/list -o artifacts/apk-webview-chat/webview-targets.json
  python scripts/android/apk_webview_real_chat_smoke.py --cdp-endpoint http://127.0.0.1:9222 --output-dir artifacts/apk-webview-chat
}
