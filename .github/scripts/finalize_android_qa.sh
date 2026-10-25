#!/usr/bin/env bash
set -euo pipefail
status="${1:-1}"
OUT="${2:-artifacts/apk-webview-chat}"
mkdir -p "$OUT"
adb logcat -d -t 3000 > "$OUT/logcat.txt" 2>&1 || true
adb shell cat /proc/net/unix > "$OUT/unix-sockets.txt" 2>&1 || true
if [ ! -s "$OUT/report.json" ]; then
  launch_status="$(cat "$OUT/launch-screenshot-status.txt" 2>/dev/null || printf NOT_CAPTURED)"
  activity_status="$(cat "$OUT/launch-activity-status.txt" 2>/dev/null || printf NOT_CONFIRMED)"
  ui_state="$(cat "$OUT/launch-ui-diagnostic.txt" 2>/dev/null || printf NOT_CHECKED)"
  printf '{"agent":"MOSHARROF Android APK WebView QA","status":"FAIL","exit_code":%s,"launch_evidence":{"screenshot_status":"%s","activity_status":"%s","ui_state":"%s"},"policy":{"physical_phone_test":false},"checks":[],"errors":[{"check":"harness_execution","detail":"Smoke test did not reach report generation; inspect logcat.txt and unix-sockets.txt."}]}\n' \
    "$status" "$launch_status" "$activity_status" "$ui_state" > "$OUT/report.json"
fi
