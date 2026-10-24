#!/usr/bin/env bash
set -euo pipefail

out_dir="artifacts/apk-webview-chat"
mkdir -p "$out_dir"
adb shell input keyevent 224 >/dev/null 2>&1 || true
png="$out_dir/apk-webview-launch.png"
for attempt in $(seq 1 5); do
  sleep 2
  rm -f "$png"
  if timeout 10s adb exec-out screencap -p > "$png" &&
     python -c 'from pathlib import Path; import sys; p=Path(sys.argv[1]); sys.exit(0 if p.is_file() and p.stat().st_size > 100 and p.read_bytes().startswith(bytes.fromhex("89504e470d0a1a0a")) else 1)' "$png"; then
    # Capture only a sanitized UI-state classification, not the full hierarchy,
    # so Android system ANR dialogs are visible in QA evidence without storing chat text.
    ui_status="ui_hierarchy_check_unavailable"
    if timeout 5s adb shell uiautomator dump /sdcard/mosharrof-launch-window.xml >/dev/null 2>&1; then
      window_xml="$(timeout 5s adb shell cat /sdcard/mosharrof-launch-window.xml 2>/dev/null | tr -d '\r' || true)"
      if [ -n "$window_xml" ]; then
        if printf '%s' "$window_xml" | grep -Eqi "Process system isn.t responding|System UI isn.t responding|Application Not Responding"; then
          ui_status="android_system_anr_dialog_detected"
        else
          ui_status="no_android_system_anr_dialog_detected"
        fi
      fi
    fi
    printf '%s\n' "$ui_status" > "$out_dir/launch-ui-diagnostic.txt"
    if [ "$ui_status" = "android_system_anr_dialog_detected" ]; then
      printf 'captured_with_android_system_anr_dialog\n' > "$out_dir/launch-screenshot-status.txt"
      echo "Launch screenshot captured, but Android system ANR dialog is visible."
    else
      printf 'captured\n' > "$out_dir/launch-screenshot-status.txt"
      echo "Launch screenshot captured (attempt $attempt/5; UI diagnostic: $ui_status)."
    fi
    exit 0
  fi
  echo "Launch screenshot not ready (attempt $attempt/5); retrying."
done
rm -f "$png"
printf 'failed\n' > "$out_dir/launch-screenshot-status.txt"
echo "Could not capture a valid APK launch screenshot after 5 attempts."
exit 1
