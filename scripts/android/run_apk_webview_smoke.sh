#!/usr/bin/env bash
set -Eeuo pipefail

OUT=artifacts/apk-webview-chat
APK=artifacts/apk/app-debug.apk
mkdir -p "$OUT"
CURRENT_STEP=initialization
step() { CURRENT_STEP="$1"; export CURRENT_STEP; echo "::notice::ANDROID_QA_STEP=$1"; echo "[android-qa] $1"; }
collect_diagnostics() {
  local status="${1:-1}"
  echo "APK WebView smoke failed (exit $status); collecting diagnostics."
  printf 'exit_code=%s\nlast_step=%s\n' "$status" "${CURRENT_STEP:-unknown}" > "$OUT/failure-summary.txt"
  timeout 20s adb devices -l > "$OUT/adb-devices.txt" 2>&1 || true
  timeout 20s adb shell getprop > "$OUT/device-properties.txt" 2>&1 || true
  timeout 20s adb shell dumpsys activity activities > "$OUT/activities.txt" 2>&1 || true
  timeout 20s adb shell pm list packages -3 > "$OUT/installed-packages.txt" 2>&1 || true
  timeout 20s adb shell cat /proc/net/unix > "$OUT/unix-sockets.txt" 2>&1 || true
  timeout 30s adb logcat -d -t 5000 > "$OUT/logcat.txt" 2>&1 || true
  timeout 20s adb exec-out screencap -p > "$OUT/failure-screen.png" 2> "$OUT/screencap-error.txt" || true
}
trap 'status=$?; collect_diagnostics "$status"; exit "$status"' ERR

step "Validate APK artifact"
test -s "$APK"
ls -lh "$APK" | tee "$OUT/apk-file.txt"

step "Wait for emulator boot and package manager"
adb wait-for-device
boot=""
for attempt in $(seq 1 120); do
  boot="$(timeout 10s adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  if [ "$boot" = "1" ]; then break; fi
  sleep 2
done
test "$boot" = "1"
pm_ready=0
for attempt in $(seq 1 30); do
  if timeout 15s adb shell pm list packages >/dev/null 2>&1; then pm_ready=1; break; fi
  sleep 2
done
test "$pm_ready" = "1"

step "Install APK with retry and captured output"
install_ok=0
for attempt in 1 2; do
  echo "[android-qa] install attempt $attempt/2"
  if timeout 180s adb install -r -g "$APK" > "$OUT/install-attempt-$attempt.txt" 2>&1; then
    cat "$OUT/install-attempt-$attempt.txt"
    install_ok=1
    break
  else
    cat "$OUT/install-attempt-$attempt.txt" || true
    timeout 20s adb shell pm list packages -3 > "$OUT/packages-after-install-failure-$attempt.txt" 2>&1 || true
    if [ "$attempt" -lt 2 ]; then sleep 5; fi
  fi
done
test "$install_ok" = "1"
timeout 30s adb shell pm path com.mosharrof.ai | tee "$OUT/package-path.txt"

step "Grant optional test permissions and launch app"
timeout 20s adb shell pm grant com.mosharrof.ai android.permission.RECORD_AUDIO || true
timeout 20s adb shell pm grant com.mosharrof.ai android.permission.READ_CONTACTS || true
timeout 20s adb shell pm grant com.mosharrof.ai android.permission.CALL_PHONE || true
timeout 20s adb shell appops set com.mosharrof.ai SYSTEM_ALERT_WINDOW allow || true
timeout 30s adb shell am start -W -n com.mosharrof.ai/.MainActivity 2>&1 | tee "$OUT/app-launch.txt"

step "Wait for debug WebView socket"
socket=""
for attempt in $(seq 1 60); do
  socket="$(timeout 10s adb shell cat /proc/net/unix 2>/dev/null | tr -d '\r' | grep -o 'webview_devtools_remote_[0-9]*' | head -n 1 || true)"
  if [ -n "$socket" ]; then break; fi
  sleep 2
done
if [ -z "$socket" ]; then
  echo "No WebView DevTools socket found after app launch." > "$OUT/webview-socket-error.txt"
  exit 1
fi
printf '%s\n' "$socket" | tee "$OUT/webview-socket.txt"
timeout 20s adb forward tcp:9222 "localabstract:$socket"

step "Discover WebView CDP targets"
timeout 45s curl --fail --silent --show-error --retry 10 --retry-delay 2 --retry-connrefused http://127.0.0.1:9222/json/list -o "$OUT/webview-targets.json"
python -c 'import json,sys; d=json.load(open(sys.argv[1])); print("CDP targets:", len(d)); print(json.dumps([{k:x.get(k) for k in ("type","title","url")} for x in d],ensure_ascii=False,indent=2)); sys.exit(0 if any(x.get("type")=="page" for x in d) else 1)' "$OUT/webview-targets.json"

step "Run real chat round-trip and capture screenshots"
python scripts/android/apk_webview_real_chat_smoke.py --cdp-endpoint http://127.0.0.1:9222 --output-dir "$OUT"
step "Android APK WebView real-chat smoke passed"
