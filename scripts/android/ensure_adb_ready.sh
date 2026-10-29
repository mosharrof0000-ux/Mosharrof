#!/usr/bin/env bash
set -euo pipefail

out_dir="${1:-artifacts/apk-webview-chat}"
mkdir -p "$out_dir"

adb start-server >/dev/null 2>&1 || true
adb devices -l > "$out_dir/adb-devices-initial.txt" 2>&1 || true

for attempt in $(seq 1 12); do
  if timeout 10s adb get-state >/dev/null 2>&1; then
    echo "ADB daemon ready after attempt $attempt"
    exit 0
  fi
  adb kill-server >/dev/null 2>&1 || true
  sleep 2
  adb start-server >/dev/null 2>&1 || true
  sleep 2
done

adb devices -l > "$out_dir/adb-devices-failed.txt" 2>&1 || true
echo "ADB daemon did not become ready after 12 recovery attempts." >&2
exit 1
