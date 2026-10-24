#!/usr/bin/env bash
set -euo pipefail

mkdir -p artifacts/apk-webview-chat

collect_diagnostics() {
  status=$?
  trap - EXIT
  if [ "$status" -ne 0 ]; then
    echo "APK WebView smoke failed with exit $status; collecting emulator diagnostics."
  fi
  adb logcat -d -t 3000 > artifacts/apk-webview-chat/logcat.txt 2>&1 || true
  adb shell cat /proc/net/unix > artifacts/apk-webview-chat/unix-sockets.txt 2>&1 || true
  {
    printf 'net.dns1='
    adb shell getprop net.dns1 2>/dev/null | tr -d '\r' || true
    printf 'net.dns2='
    adb shell getprop net.dns2 2>/dev/null | tr -d '\r' || true
    printf '\nConnectivity summary:\n'
    adb shell dumpsys connectivity 2>/dev/null | grep -E 'NetworkAgentInfo|VALIDATED|INTERNET|TRANSPORT_WIFI|TRANSPORT_CELLULAR' | head -n 80 || true
  } > artifacts/apk-webview-chat/network-diagnostics.txt 2>&1
  exit "$status"
}
trap collect_diagnostics EXIT

test -s artifacts/apk/app-debug.apk

for attempt in $(seq 1 60); do
  boot="$(timeout 10s adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  if [ "$boot" = "1" ]; then
    break
  fi
  sleep 2
done
test "$(timeout 10s adb shell getprop sys.boot_completed | tr -d '\r')" = "1"

bash .github/scripts/install_apk_with_retry.sh
adb shell am start -n com.mosharrof.ai/.MainActivity
# Wake the emulator display and retry the launch frame: a single early
# screencap can be empty while Android is still bringing the activity forward.
adb shell input keyevent 224 >/dev/null 2>&1 || true
launch_png="artifacts/apk-webview-chat/apk-webview-launch.png"
launch_captured=0
for attempt in $(seq 1 5); do
  sleep 2
  rm -f "$launch_png"
  if timeout 10s adb exec-out screencap -p > "$launch_png" && \
     python -c 'from pathlib import Path; import sys; p=Path(sys.argv[1]); sys.exit(0 if p.is_file() and p.stat().st_size > 100 and p.read_bytes().startswith(bytes.fromhex("89504e470d0a1a0a")) else 1)' "$launch_png"; then
    launch_captured=1
    printf 'captured\n' > artifacts/apk-webview-chat/launch-screenshot-status.txt
    echo "Launch screenshot captured (attempt $attempt/5)."
    break
  fi
  echo "Launch screenshot not ready (attempt $attempt/5); retrying."
done
if [ "$launch_captured" != "1" ]; then
  rm -f "$launch_png"
  printf 'failed\n' > artifacts/apk-webview-chat/launch-screenshot-status.txt
  echo "Could not capture a valid APK launch screenshot after 5 attempts."
  exit 1
fi
sleep 13

bash scripts/android/discover_webview_cdp.sh
python scripts/android/apk_webview_real_chat_smoke.py --cdp-endpoint http://127.0.0.1:9222 --output-dir artifacts/apk-webview-chat
