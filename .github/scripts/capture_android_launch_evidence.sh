#!/usr/bin/env bash
set -euo pipefail

OUT="${1:-artifacts/apk-webview-chat}"
mkdir -p "$OUT"
source scripts/android/android_anr_dialog_recovery.sh
activity_status="NOT_CONFIRMED"
launch_status="NOT_CAPTURED"
ui_state="NOT_CHECKED"

# Capture as soon as Android reports the first displayed frame; otherwise capture after a bounded wait.
# Do not use grep -q on this live pipeline under pipefail: early exit can
# signal adb with SIGPIPE and hide the matching activity line.
for attempt in $(seq 1 30); do
  if adb logcat -d -s ActivityTaskManager:I 2>/dev/null | grep 'Displayed com.mosharrof.ai/.MainActivity' >/dev/null; then
    activity_status="DISPLAYED"
    break
  fi
  sleep 1
done
printf '%s\n' "$activity_status" > "$OUT/launch-activity-status.txt"

# Prefer adb exec-out (one stream, no remote-file/pull race); retain shell/pull as fallback.
for attempt in 1 2 3 4 5; do
  if timeout 20s adb exec-out screencap -p > "$OUT/apk-webview-launch.png" 2>/dev/null \
    && test -s "$OUT/apk-webview-launch.png"; then
    launch_status="CAPTURED"
    break
  fi
  if timeout 20s adb shell screencap -p /sdcard/mosharrof-launch.png >/dev/null 2>&1 \
    && timeout 15s adb pull /sdcard/mosharrof-launch.png "$OUT/apk-webview-launch.png" >/dev/null 2>&1 \
    && test -s "$OUT/apk-webview-launch.png"; then
    launch_status="CAPTURED"
    break
  fi
  sleep 2
done
printf '%s\n' "$launch_status" > "$OUT/launch-screenshot-status.txt"

# uiautomator can transiently time out while Android is settling; retry before
# classifying the hierarchy as unavailable. Preserve the captured hierarchy for diagnosis.
for attempt in 1 2 3; do
  if timeout 25s adb shell uiautomator dump /sdcard/mosharrof-ui.xml >/dev/null 2>&1; then
    timeout 15s adb shell cat /sdcard/mosharrof-ui.xml > "$OUT/launch-ui-hierarchy.xml" 2>/dev/null || true
    if [ -s "$OUT/launch-ui-hierarchy.xml" ]; then break; fi
  fi
  sleep 2
done

# The screenshot can show a system ANR even when uiautomator omits its dialog.
# Cross-check the focused-window dump before recording a clean UI state.
timeout 12s adb shell dumpsys window windows > "$OUT/launch-window-dump.txt" 2>/dev/null || true
ui_state="$(python - "$OUT/launch-ui-hierarchy.xml" "$OUT/launch-window-dump.txt" <<'PY'
import sys
from pathlib import Path
sys.path.insert(0, ".github/scripts")
from android_qa_cdp import classify_launch_ui_state

def read(path):
    try:
        return Path(path).read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""

print(classify_launch_ui_state(read(sys.argv[1]), read(sys.argv[2])))
PY
)"

# Keep original ANR classification as a failing check, but dismiss the captured
# system dialog so the real chat round-trip can still collect independent evidence.
printf '%s\n' "$ui_state" > "$OUT/launch-ui-diagnostic.txt"
recover_anr_dialog_for_diagnostics "$OUT" "$ui_state"
adb shell rm -f /sdcard/mosharrof-launch.png /sdcard/mosharrof-ui.xml >/dev/null 2>&1 || true
