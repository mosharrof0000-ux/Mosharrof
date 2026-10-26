#!/usr/bin/env bash
set -Eeuo pipefail

OUT="artifacts/apk-webview-chat"
mkdir -p "$OUT"
STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
CURRENT_STEP="initialization"
LOGCAT_DUMPED=0

# Bash has no try/catch; ERR/EXIT traps plus bounded retry helpers provide
# equivalent cleanup and diagnostics without hiding the original exit status.
dump_diagnostics() {
  local reason="${1:-unknown}"
  {
    printf 'started_at=%s\n' "$STARTED_AT"
    printf 'finished_at=%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    printf 'failure_step=%s\n' "$CURRENT_STEP"
    printf 'failure_reason=%s\n' "$reason"
    printf '\n--- adb devices ---\n'
    timeout 10s adb devices -l 2>&1 || true
    printf '\n--- boot state ---\n'
    timeout 10s adb shell getprop sys.boot_completed 2>&1 || true
    printf '\n--- package state ---\n'
    timeout 10s adb shell dumpsys package com.mosharrof.ai 2>&1 | head -n 120 || true
    printf '\n--- activity/process state ---\n'
    timeout 10s adb shell dumpsys activity activities 2>&1 | head -n 160 || true
    timeout 10s adb shell ps -A 2>&1 | grep -E 'mosharrof|webview' || true
    printf '\n--- webview devtools socket ---\n'
    timeout 10s adb shell cat /proc/net/unix 2>&1 | grep -E 'webview_devtools_remote|devtools' || true
    printf '\n--- port 9222 ---\n'
    adb forward --list 2>&1 || true
    timeout 5s curl -sv --max-time 4 http://127.0.0.1:9222/json/version -o "$OUT/webview-version-diagnostic.json" 2>"$OUT/webview-port-diagnostic.log" || true
  } > "$OUT/android-diagnostics.txt" 2>&1

  # Preserve full device logs before the job exits; keep a bounded recent log
  # as well so the artifact remains practical to download.
  timeout 30s adb logcat -d -v threadtime > "$OUT/adb-logcat-full.txt" 2>&1 || true
  tail -n 12000 "$OUT/adb-logcat-full.txt" > "$OUT/adb-logcat-tail.txt" 2>/dev/null || true
  LOGCAT_DUMPED=1
}

finish() {
  local status=$?
  trap - EXIT ERR
  if [ "$status" -ne 0 ] && [ "$LOGCAT_DUMPED" -eq 0 ]; then
    dump_diagnostics "exit_status=$status step=$CURRENT_STEP"
  elif [ "$LOGCAT_DUMPED" -eq 0 ]; then
    # Successful runs also retain device logs for auditability.
    timeout 30s adb logcat -d -v threadtime > "$OUT/adb-logcat-full.txt" 2>&1 || true
    tail -n 12000 "$OUT/adb-logcat-full.txt" > "$OUT/adb-logcat-tail.txt" 2>/dev/null || true
  fi
  bash .github/scripts/finalize_android_qa.sh "$status" "$OUT" || true
  exit "$status"
}
trap finish EXIT
trap 'rc=$?; printf "ERROR: step=%s line=%s exit=%s\n" "$CURRENT_STEP" "$LINENO" "$rc" >&2; exit "$rc"' ERR

wait_for_adb() {
  local attempt
  for attempt in $(seq 1 30); do
    if timeout 8s adb get-state 2>/dev/null | grep -Fxq device; then
      return 0
    fi
    echo "Waiting for adb device ($attempt/30)"
    sleep 2
  done
  echo "adb device did not become ready within 60 seconds" >&2
  return 1
}

wait_for_boot() {
  local attempt boot
  for attempt in $(seq 1 60); do
    boot="$(timeout 8s adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' || true)"
    if [ "$boot" = "1" ]; then
      # Let Android services and WebView settle after the boot flag.
      sleep 5
      return 0
    fi
    echo "Waiting for Android boot ($attempt/60)"
    sleep 2
  done
  echo "Android boot did not complete within 120 seconds" >&2
  return 1
}

wait_for_app_process() {
  local attempt pid
  for attempt in $(seq 1 30); do
    pid="$(timeout 8s adb shell pidof com.mosharrof.ai 2>/dev/null | tr -d '\r' | awk '{print $1}' || true)"
    if [ -n "$pid" ]; then
      printf '%s' "$pid"
      return 0
    fi
    echo "Waiting for app process ($attempt/30)" >&2
    sleep 2
  done
  echo "MOSHARROF process did not appear within 60 seconds" >&2
  return 1
}

wait_for_devtools_socket() {
  local socket="$1" attempt
  for attempt in $(seq 1 30); do
    if timeout 8s adb shell cat /proc/net/unix 2>/dev/null | tr -d '\r' | grep -F "$socket" >/dev/null; then
      return 0
    fi
    echo "Waiting for WebView DevTools socket $socket ($attempt/30)"
    sleep 2
  done
  echo "WebView DevTools socket did not appear within 60 seconds: $socket" >&2
  return 1
}

wait_for_cdp() {
  local attempt
  for attempt in $(seq 1 30); do
    if timeout 5s curl --silent --show-error --fail --max-time 4 \
      http://127.0.0.1:9222/json/list -o "$OUT/webview-targets.json.tmp" 2>"$OUT/webview-cdp-wait.log"; then
      mv "$OUT/webview-targets.json.tmp" "$OUT/webview-targets.json"
      if python - "$OUT/webview-targets.json" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as f:
    targets = json.load(f)
raise SystemExit(0 if isinstance(targets, list) and any(t.get("webSocketDebuggerUrl") for t in targets) else 1)
PY
      then
        return 0
      fi
    fi
    echo "Waiting for WebView CDP endpoint on port 9222 ($attempt/30)"
    sleep 2
  done
  echo "WebView CDP endpoint did not become ready within 60 seconds" >&2
  return 1
}

CURRENT_STEP="verify APK artifact"
test -s artifacts/apk/app-debug.apk

CURRENT_STEP="wait for adb and Android boot"
wait_for_adb
wait_for_boot

CURRENT_STEP="install APK"
timeout 90s adb install -r artifacts/apk/app-debug.apk
# Avoid grep -q here: with pipefail, an early match can close the pipe and
# turn a successful check into SIGPIPE (exit 141) from adb.
timeout 10s adb shell pm path com.mosharrof.ai | grep 'package:' >/dev/null

CURRENT_STEP="clear prior logcat and launch app"
adb logcat -c || true
timeout 20s adb shell am start -n com.mosharrof.ai/.MainActivity
bash .github/scripts/capture_android_launch_evidence.sh "$OUT"

CURRENT_STEP="wait for app process"
app_pid="$(wait_for_app_process)"

CURRENT_STEP="wait for WebView DevTools socket"
socket="webview_devtools_remote_${app_pid}"
wait_for_devtools_socket "$socket"

CURRENT_STEP="forward CDP port 9222"
adb forward --remove tcp:9222 >/dev/null 2>&1 || true
timeout 10s adb forward tcp:9222 "localabstract:$socket"

CURRENT_STEP="wait for WebView CDP endpoint"
wait_for_cdp

CURRENT_STEP="run real chat round-trip and visibility assertions"
python scripts/android/apk_webview_real_chat_smoke.py \
  --cdp-endpoint http://127.0.0.1:9222 --output-dir "$OUT"

CURRENT_STEP="capture final device logs"
timeout 30s adb logcat -d -v threadtime > "$OUT/adb-logcat-full.txt" 2>&1 || true
tail -n 12000 "$OUT/adb-logcat-full.txt" > "$OUT/adb-logcat-tail.txt" 2>/dev/null || true
