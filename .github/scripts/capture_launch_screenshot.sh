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
    printf 'captured\n' > "$out_dir/launch-screenshot-status.txt"
    echo "Launch screenshot captured (attempt $attempt/5)."
    exit 0
  fi
  echo "Launch screenshot not ready (attempt $attempt/5); retrying."
done
rm -f "$png"
printf 'failed\n' > "$out_dir/launch-screenshot-status.txt"
echo "Could not capture a valid APK launch screenshot after 5 attempts."
exit 1
