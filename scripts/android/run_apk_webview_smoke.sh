#!/usr/bin/env bash
set -euo pipefail

OUT="artifacts/apk-webview-chat"
mkdir -p "$OUT"

finish() {
  local status=$?
  trap - EXIT
  bash .github/scripts/finalize_android_qa.sh "$status" "$OUT" || true
  exit "$status"
}
trap finish EXIT

test -s artifacts/apk/app-debug.apk
for attempt in $(seq 1 60); do
  boot="$(timeout 10s adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
  [ "$boot" = "1" ] && break
  sleep 2
done
test "$(timeout 10s adb shell getprop sys.boot_completed | tr -d '\r')" = "1"

timeout 60s adb install -r artifacts/apk/app-debug.apk
# Avoid grep -q here: with pipefail, an early match can close the pipe and
# turn a successful check into SIGPIPE (exit 141) from adb.
adb shell pm path com.mosharrof.ai | grep 'package:' >/dev/null
adb logcat -c || true
adb shell am start -n com.mosharrof.ai/.MainActivity
bash .github/scripts/capture_android_launch_evidence.sh "$OUT"
sleep 10

app_pid="$(timeout 10s adb shell pidof com.mosharrof.ai 2>/dev/null | tr -d '\r' | awk '{print $1}' || true)"
test -n "$app_pid"
socket="webview_devtools_remote_${app_pid}"
# Read the full socket listing before matching so grep does not terminate
# adb/tr early and trigger pipefail/SIGPIPE.
timeout 10s adb shell cat /proc/net/unix 2>/dev/null | tr -d '\r' | grep -F "$socket" >/dev/null
adb forward tcp:9222 "localabstract:$socket"
timeout 30s curl --retry 10 --retry-delay 2 --retry-connrefused \
  http://127.0.0.1:9222/json/list -o "$OUT/webview-targets.json"
python scripts/android/apk_webview_real_chat_smoke.py \
  --cdp-endpoint http://127.0.0.1:9222 --output-dir "$OUT"
