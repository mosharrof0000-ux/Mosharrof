#!/usr/bin/env bash
set -euo pipefail

# Recover a transient ADB daemon startup race before emulator readiness checks.
adb_ready=0
for attempt in $(seq 1 8); do
  adb start-server >/dev/null 2>&1 || true
  if timeout 10s adb devices >/tmp/mosharrof-adb-devices.txt 2>&1; then
    adb_ready=1
    break
  fi
  echo "ADB daemon not ready (attempt $attempt/8); retrying."
  sleep $((attempt * 2))
done
if [ "$adb_ready" != "1" ]; then
  cat /tmp/mosharrof-adb-devices.txt || true
  echo "ADB daemon did not become ready after retries."
  exit 1
fi
