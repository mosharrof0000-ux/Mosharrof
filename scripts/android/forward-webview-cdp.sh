#!/usr/bin/env bash
set -euo pipefail
mkdir -p artifacts/apk-webview-chat
pid="$(adb shell pidof com.mosharrof.ai | tr -d '\r' | awk '{print $1}')"
test -n "$pid"
socket="webview_devtools_remote_$pid"
unix=""
for attempt in $(seq 1 45); do
  unix="$(adb shell cat /proc/net/unix 2>/dev/null | tr -d '\r' || true)"
  [[ "$unix" == *"$socket"* ]] && break
  sleep 2
done
printf '%s\n' "$unix" > artifacts/apk-webview-chat/unix-sockets-before-cdp.txt
grep -Fq "$socket" artifacts/apk-webview-chat/unix-sockets-before-cdp.txt
echo "WebView CDP socket found for app PID $pid"
adb forward --remove tcp:9222 >/dev/null 2>&1 || true
adb forward tcp:9222 "localabstract:$socket"
timeout 45s curl --retry 10 --retry-delay 2 --retry-connrefused http://127.0.0.1:9222/json/version -o artifacts/apk-webview-chat/webview-version.json
timeout 45s curl --retry 10 --retry-delay 2 --retry-connrefused http://127.0.0.1:9222/json/list -o artifacts/apk-webview-chat/webview-targets.json
sleep 10
