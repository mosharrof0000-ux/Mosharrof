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

if ! timeout 60s adb install -r artifacts/apk/app-debug.apk; then
  adb logcat -d -t 3000 > artifacts/apk-webview-chat/logcat.txt 2>&1 || true
  exit 1
fi

adb shell pm grant com.mosharrof.ai android.permission.RECORD_AUDIO || true
adb shell pm grant com.mosharrof.ai android.permission.READ_CONTACTS || true
adb shell pm grant com.mosharrof.ai android.permission.CALL_PHONE || true
adb shell appops set com.mosharrof.ai SYSTEM_ALERT_WINDOW allow || true
adb shell am start -n com.mosharrof.ai/.MainActivity
sleep 15

# Select the WebView socket belonging to this app, rather than the first
# WebView socket in /proc/net/unix (which can belong to another process).
pid="$(timeout 10s adb shell pidof com.mosharrof.ai 2>/dev/null | tr -d '\r' | awk '{print $1}' || true)"
socket=""
for attempt in $(seq 1 45); do
  unix_sockets="$(timeout 10s adb shell cat /proc/net/unix 2>/dev/null | tr -d '\r' || true)"
  if [ -n "$pid" ]; then
    socket="$(printf '%s\n' "$unix_sockets" | grep -o "webview_devtools_remote_$pid" | head -n 1 || true)"
  fi
  if [ -z "$socket" ]; then
    socket="$(printf '%s\n' "$unix_sockets" | awk '/webview_devtools_remote_[0-9]+/ {print $NF}' | sed 's/.*webview_devtools_remote_/webview_devtools_remote_/' | sort -u | head -n 1 || true)"
  fi
  if [ -n "$socket" ]; then break; fi
  sleep 2
done
if [ -z "$socket" ]; then
  echo "No WebView DevTools socket found; app process and sockets follow."
  adb shell pidof com.mosharrof.ai > artifacts/apk-webview-chat/app-pid.txt 2>&1 || true
  adb shell cat /proc/net/unix > artifacts/apk-webview-chat/unix-sockets.txt 2>&1 || true
  adb shell dumpsys activity activities > artifacts/apk-webview-chat/activities.txt 2>&1 || true
  exit 1
fi

adb forward --remove tcp:9222 >/dev/null 2>&1 || true
adb forward tcp:9222 "localabstract:$socket"

# A successful HTTP response is not sufficient: Android may return an empty,
# stale, or non-JSON target list. Retry until a valid page target appears.
valid_targets=0
for attempt in $(seq 1 15); do
  if timeout 10s curl -fsS http://127.0.0.1:9222/json/list -o artifacts/apk-webview-chat/webview-targets.json; then
    if python - <<'PY'
import json
from pathlib import Path
p = Path("artifacts/apk-webview-chat/webview-targets.json")
try:
    targets = json.loads(p.read_text(encoding="utf-8"))
    assert isinstance(targets, list)
    assert any(isinstance(t, dict) and t.get("type") == "page" and t.get("webSocketDebuggerUrl") for t in targets)
except Exception:
    raise SystemExit(1)
PY
    then
      valid_targets=1
      break
    fi
  fi
  echo "DevTools target list not ready/valid (attempt $attempt/15)"
  sleep 2
done

if [ "$valid_targets" != "1" ]; then
  echo "DevTools endpoint did not return a valid page target."
  curl -v --max-time 5 http://127.0.0.1:9222/json/list > artifacts/apk-webview-chat/webview-targets-debug.txt 2>&1 || true
  curl -v --max-time 5 http://127.0.0.1:9222/json/version > artifacts/apk-webview-chat/webview-version-debug.txt 2>&1 || true
  adb logcat -d -t 5000 | grep -iE 'chromium|webview|devtools|mosharrof|console' > artifacts/apk-webview-chat/webview-logcat.txt || true
  exit 1
fi

python scripts/android/apk_webview_real_chat_smoke.py --cdp-endpoint http://127.0.0.1:9222 --output-dir artifacts/apk-webview-chat
