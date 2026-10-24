#!/usr/bin/env bash
set -euo pipefail

OUT="artifacts/apk-webview-chat"
mkdir -p "$OUT"
launch_status="NOT_CAPTURED"
launch_ui_state="NOT_CHECKED"
launch_activity_status="NOT_CONFIRMED"

finish() {
  local status=$?
  trap - EXIT
  adb logcat -d -t 3000 > "$OUT/logcat.txt" 2>&1 || true
  adb shell cat /proc/net/unix > "$OUT/unix-sockets.txt" 2>&1 || true
  if [ ! -s "$OUT/report.json" ]; then
    printf '{"agent":"MOSHARROF Android APK WebView QA","status":"FAIL","exit_code":%s,"launch_evidence":{"screenshot_status":"%s","activity_status":"%s","ui_state":"%s"},"policy":{"physical_phone_test":false},"checks":[],"errors":[{"check":"harness_execution","detail":"Smoke test did not reach report generation; inspect sanitized diagnostics and logcat."}]}\n' \
      "$status" "$launch_status" "$launch_activity_status" "$launch_ui_state" > "$OUT/report.json"
  fi
  exit "$status"
}
trap finish EXIT

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
  exit 1
fi
adb shell pm path com.mosharrof.ai | grep -q 'package:'
adb logcat -c || true
adb shell am start -n com.mosharrof.ai/.MainActivity

for attempt in $(seq 1 30); do
  if adb logcat -d -s ActivityTaskManager:I 2>/dev/null | grep -q 'Displayed com.mosharrof.ai/.MainActivity'; then
    launch_activity_status="DISPLAYED"
    break
  fi
  sleep 1
done
printf '%s\n' "$launch_activity_status" > "$OUT/launch-activity-status.txt"

for attempt in 1 2 3; do
  if timeout 12s adb shell screencap -p /sdcard/mosharrof-launch.png >/dev/null 2>&1 \
    && timeout 12s adb pull /sdcard/mosharrof-launch.png "$OUT/apk-webview-launch.png" >/dev/null 2>&1 \
    && test -s "$OUT/apk-webview-launch.png"; then
    launch_status="CAPTURED"
    break
  fi
  sleep 1
done
printf '%s\n' "$launch_status" > "$OUT/launch-screenshot-status.txt"

ui_dump_ok=false
if timeout 15s adb shell uiautomator dump /sdcard/mosharrof-ui.xml >/dev/null 2>&1; then
  ui_dump_ok=true
  ui_text="$(timeout 10s adb shell cat /sdcard/mosharrof-ui.xml 2>/dev/null | tr -d '\r' || true)"
  if printf '%s' "$ui_text" | grep -Eqi "isn.t responding|not responding|Process system"; then
    launch_ui_state="SYSTEM_ANR_DIALOG"
  elif printf '%s' "$ui_text" | grep -qi 'Wait' && printf '%s' "$ui_text" | grep -qi 'Close app'; then
    launch_ui_state="SYSTEM_ANR_DIALOG"
  else
    launch_ui_state="NO_SYSTEM_ANR_DIALOG"
  fi
fi
if [ "$ui_dump_ok" != true ]; then
  launch_ui_state="UI_HIERARCHY_UNAVAILABLE"
fi
printf '%s\n' "$launch_ui_state" > "$OUT/launch-ui-diagnostic.txt"
adb shell rm -f /sdcard/mosharrof-launch.png /sdcard/mosharrof-ui.xml >/dev/null 2>&1 || true

# Keep launch evidence separate; allow the chat probe to run even when UI diagnostics warn.
sleep 10

app_pid="$(timeout 10s adb shell pidof com.mosharrof.ai 2>/dev/null | tr -d '\r' | awk '{print $1}' || true)"
test -n "$app_pid"
socket="webview_devtools_remote_${app_pid}"
if ! timeout 10s adb shell cat /proc/net/unix 2>/dev/null | tr -d '\r' | grep -Fq "$socket"; then
  echo "Expected WebView devtools socket for the launched app PID was not found." >&2
  exit 1
fi
adb forward tcp:9222 "localabstract:$socket"
timeout 30s curl --retry 10 --retry-delay 2 --retry-connrefused \
  http://127.0.0.1:9222/json/list -o "$OUT/webview-targets.json"
python scripts/android/apk_webview_real_chat_smoke.py \
  --cdp-endpoint http://127.0.0.1:9222 --output-dir "$OUT"
