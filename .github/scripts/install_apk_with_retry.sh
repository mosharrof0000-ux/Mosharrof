#!/usr/bin/env bash
set -euo pipefail

mkdir -p artifacts/apk-webview-chat
log="artifacts/apk-webview-chat/install.log"
ready=0
for attempt in $(seq 1 30); do
  if timeout 12s adb shell pm path android >/dev/null 2>&1; then
    ready=1
    break
  fi
  adb wait-for-device || true
  sleep 3
done
if [ "$ready" != "1" ]; then
  echo "PackageManager did not become ready after emulator boot." | tee "$log"
  adb devices -l > artifacts/apk-webview-chat/adb-devices.txt 2>&1 || true
  adb logcat -d -t 3000 > artifacts/apk-webview-chat/logcat.txt 2>&1 || true
  exit 1
fi

installed=0
for attempt in $(seq 1 3); do
  echo "APK install attempt $attempt/3" >> "$log"
  if timeout 150s adb install -r artifacts/apk/app-debug.apk >> "$log" 2>&1; then
    installed=1
    break
  fi
  echo "Install attempt $attempt failed; checking emulator/package service." >> "$log"
  adb devices -l > artifacts/apk-webview-chat/adb-devices.txt 2>&1 || true
  adb wait-for-device || true
  sleep 8
  timeout 12s adb shell pm path android >> "$log" 2>&1 || true
done
cat "$log"
if [ "$installed" != "1" ]; then
  adb logcat -d -t 3000 > artifacts/apk-webview-chat/logcat.txt 2>&1 || true
  exit 1
fi
