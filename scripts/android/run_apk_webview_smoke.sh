#!/usr/bin/env bash
set -Eeuo pipefail

OUT="artifacts/apk-webview-chat"
mkdir -p "$OUT"
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
CURRENT_STEP="initialization"
LOGCAT_DUMPED=0
source scripts/android/apk_webview_qa_helpers.sh

finish() {
  local status=$?
  trap - EXIT ERR
  if [ "$status" -ne 0 ] && [ "$LOGCAT_DUMPED" -eq 0 ]; then
    dump_diagnostics "exit_status=$status step=$CURRENT_STEP"
  fi
  bash .github/scripts/finalize_android_qa.sh "$status" "$OUT" || true
  exit "$status"
}
trap finish EXIT
trap 'rc=$?; printf "ERROR: step=%s line=%s exit=%s\n" "$CURRENT_STEP" "$LINENO" "$rc" >&2; exit "$rc"' ERR

CURRENT_STEP="verify APK artifact"
test -s artifacts/apk/app-debug.apk
CURRENT_STEP="wait for adb and Android boot"
wait_for_adb
wait_for_boot
assert_adb_healthy
CURRENT_STEP="install APK"
timeout 90s adb install -r artifacts/apk/app-debug.apk
timeout 10s adb shell pm path com.mosharrof.ai | grep 'package:' >/dev/null
CURRENT_STEP="clear prior logcat and launch app"
adb logcat -c || true
timeout 20s adb shell am start -n com.mosharrof.ai/.MainActivity
bash .github/scripts/capture_android_launch_evidence.sh "$OUT"
CURRENT_STEP="verify adb after launch evidence"
assert_adb_healthy
CURRENT_STEP="wait for app process"
app_pid="$(wait_for_app_process)"
CURRENT_STEP="wait for WebView DevTools socket"
socket="webview_devtools_remote_${app_pid}"
wait_for_devtools_socket "$socket"
CURRENT_STEP="verify adb before CDP forwarding"
assert_adb_healthy
CURRENT_STEP="forward CDP port 9222"
adb forward --remove tcp:9222 >/dev/null 2>&1 || true
timeout 10s adb forward tcp:9222 "localabstract:$socket"
CURRENT_STEP="wait for WebView CDP endpoint"
wait_for_cdp
CURRENT_STEP="run real chat round-trip and visibility assertions"
python scripts/android/apk_webview_real_chat_smoke.py --cdp-endpoint http://127.0.0.1:9222 --output-dir "$OUT"
CURRENT_STEP="capture final device logs"
timeout 30s adb logcat -d -v threadtime > "$OUT/adb-logcat-full.txt" 2>&1 || true
tail -n 12000 "$OUT/adb-logcat-full.txt" > "$OUT/adb-logcat-tail.txt" 2>/dev/null || true
