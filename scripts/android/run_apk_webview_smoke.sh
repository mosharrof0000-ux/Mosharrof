#!/usr/bin/env bash
set -euo pipefail

mkdir -p artifacts/apk-webview-chat
trap 'status=$?; echo "APK WebView smoke failed with exit $status; collecting emulator diagnostics."; adb logcat -d -t 3000 > artifacts/apk-webview-chat/logcat.txt 2>&1 || true; adb shell cat /proc/net/unix > artifacts/apk-webview-chat/unix-sockets.txt 2>&1 || true; exit "$status"' ERR

test -s artifacts/apk/app-debug.apk

for attempt in $(seq 1 60); do
  boot="$(timeout 10s adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  if [ "$boot" = "1" ]; then
    break
  fi
  sleep 2
done
test "$(timeout 10s adb shell getprop sys.boot_completed | tr -d '\r')" = "1"

# Emulator can report boot-complete before PackageManager is ready. Wait
# for the package service and retry transient adb "Broken pipe" failures.
package_ready=0
for attempt in $(seq 1 30); do
  if timeout 12s adb shell pm path android >/dev/null 2>&1; then
    package_ready=1
    break
  fi
  adb wait-for-device || true
  sleep 3
done
if [ "$package_ready" != "1" ]; then
  echo "PackageManager did not become ready after emulator boot." | tee artifacts/apk-webview-chat/install.log
  adb devices -l > artifacts/apk-webview-chat/adb-devices.txt 2>&1 || true
  adb logcat -d -t 3000 > artifacts/apk-webview-chat/logcat.txt 2>&1 || true
  exit 1
fi

install_ok=0
for attempt in $(seq 1 3); do
  echo "APK install attempt $attempt/3" >> artifacts/apk-webview-chat/install.log
  if timeout 150s adb install -r artifacts/apk/app-debug.apk >> artifacts/apk-webview-chat/install.log 2>&1; then
    install_ok=1
    break
  fi
  echo "Install attempt $attempt failed; checking emulator/package service." >> artifacts/apk-webview-chat/install.log
  adb devices -l > artifacts/apk-webview-chat/adb-devices.txt 2>&1 || true
  adb wait-for-device || true
  sleep 8
  timeout 12s adb shell pm path android >> artifacts/apk-webview-chat/install.log 2>&1 || true
done
if [ "$install_ok" != "1" ]; then
  cat artifacts/apk-webview-chat/install.log
  adb devices -l > artifacts/apk-webview-chat/adb-devices.txt 2>&1 || true
  adb logcat -d -t 3000 > artifacts/apk-webview-chat/logcat.txt 2>&1 || true
  exit 1
fi
cat artifacts/apk-webview-chat/install.log

adb shell am start -n com.mosharrof.ai/.MainActivity
sleep 15

# Keep device target discovery isolated so the smoke entrypoint stays within
# the repository's per-file growth budget.
bash scripts/android/discover_webview_cdp.sh

python scripts/android/apk_webview_real_chat_smoke.py --cdp-endpoint http://127.0.0.1:9222 --output-dir artifacts/apk-webview-chat
