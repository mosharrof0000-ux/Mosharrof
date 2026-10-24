#!/usr/bin/env bash
set -euo pipefail

out_dir="artifacts/apk-webview-chat"
mkdir -p "$out_dir"
png="$out_dir/apk-webview-launch.png"
device_png="/sdcard/mosharrof-launch.png"
window_xml="/sdcard/mosharrof-launch-window.xml"

valid_png() {
  python -c 'from pathlib import Path; import sys; p=Path(sys.argv[1]); sys.exit(0 if p.is_file() and p.stat().st_size > 100 and p.read_bytes().startswith(bytes.fromhex("89504e470d0a1a0a")) else 1)' "$1"
}

classify_ui() {
  local ui_status="ui_hierarchy_check_unavailable"
  local window_xml_content=""
  if timeout 8s adb shell uiautomator dump "$window_xml" >/dev/null 2>&1; then
    window_xml_content="$(timeout 5s adb shell cat "$window_xml" 2>/dev/null | tr -d '\r' || true)"
    timeout 5s adb shell rm -f "$window_xml" >/dev/null 2>&1 || true
    if [ -n "$window_xml_content" ]; then
      if printf '%s' "$window_xml_content" | grep -Eqi "Process system isn.t responding|System UI isn.t responding|Application Not Responding"; then
        ui_status="android_system_anr_dialog_detected"
      else
        ui_status="no_android_system_anr_dialog_detected"
      fi
    fi
  fi
  printf '%s' "$ui_status"
}

adb shell input keyevent 224 >/dev/null 2>&1 || true

# Wait for the first app frame (or an explicit system-ANR signal) before capturing.
# Some cold emulator launches take over a minute after am start returns.
launch_state="launch_frame_not_confirmed"
for attempt in $(seq 1 45); do
  recent_log="$(timeout 3s adb logcat -d -t 4000 2>/dev/null || true)"
  if printf '%s' "$recent_log" | grep -Fq "Displayed com.mosharrof.ai/.MainActivity"; then
    launch_state="app_first_frame_displayed"
    break
  fi
  if printf '%s' "$recent_log" | grep -Eqi "ANR in system|Process system isn.t responding|Input dispatching timed out.*system"; then
    launch_state="android_system_anr_suspected"
    break
  fi
  sleep 2
done
printf '%s\n' "$launch_state" > "$out_dir/launch-wait-status.txt"

capture_method="none"
for attempt in $(seq 1 5); do
  sleep 1
  rm -f "$png"
  if timeout 15s adb exec-out screencap -p > "$png" 2>/dev/null && valid_png "$png"; then
    capture_method="adb_exec_out"
    break
  fi

  rm -f "$png"
  if timeout 15s adb shell screencap -p "$device_png" >/dev/null 2>&1 &&
     timeout 15s adb pull "$device_png" "$png" >/dev/null 2>&1 &&
     valid_png "$png"; then
    capture_method="device_file_pull"
    timeout 5s adb shell rm -f "$device_png" >/dev/null 2>&1 || true
    break
  fi

  rm -f "$png"
  echo "Launch screenshot not ready (attempt $attempt/5; launch state: $launch_state); retrying."
done

if valid_png "$png"; then
  ui_status="$(classify_ui)"
  printf '%s\n' "$ui_status" > "$out_dir/launch-ui-diagnostic.txt"
  printf 'captured\n' > "$out_dir/launch-screenshot-status.txt"
  printf 'capture_method=%s\nlaunch_state=%s\nui_diagnostic=%s\n' "$capture_method" "$launch_state" "$ui_status" > "$out_dir/launch-capture-details.txt"
  if [ "$ui_status" = "android_system_anr_dialog_detected" ]; then
    echo "Launch screenshot captured; Android system ANR dialog detected and recorded separately from chat."
  else
    echo "Launch screenshot captured (method: $capture_method; UI diagnostic: $ui_status)."
  fi
  exit 0
fi

ui_status="$(classify_ui)"
printf '%s\n' "$ui_status" > "$out_dir/launch-ui-diagnostic.txt"
printf 'failed\n' > "$out_dir/launch-screenshot-status.txt"
printf 'capture_method=none\nlaunch_state=%s\nui_diagnostic=%s\n' "$launch_state" "$ui_status" > "$out_dir/launch-capture-details.txt"
echo "Could not capture a valid APK launch screenshot after 5 attempts."
exit 1
