#!/usr/bin/env bash
# Dismiss a detected Android ANR dialog only after the original launch screenshot
# and classification have been saved. Keep the original classification unchanged.
recover_anr_dialog_for_diagnostics() {
  local out="$1" state="$2" post
  if [ "$state" != "SYSTEM_ANR_DIALOG" ]; then
    printf 'NOT_NEEDED\n' > "$out/anr-dialog-recovery.txt"
    return 0
  fi
  printf 'DETECTED_BEFORE_DISMISS\n' > "$out/anr-dialog-recovery.txt"
  timeout 8s adb shell input keyevent KEYCODE_BACK >/dev/null 2>&1 || true
  sleep 2
  if timeout 15s adb shell uiautomator dump /sdcard/mosharrof-recovery-ui.xml >/dev/null 2>&1; then
    post="$(timeout 8s adb shell cat /sdcard/mosharrof-recovery-ui.xml 2>/dev/null | tr -d '\r' || true)"
    post="${post,,}"
    if [[ "$post" == *"isn't responding"* || "$post" == *"not responding"* || ( "$post" == *"wait"* && "$post" == *"close app"* ) ]]; then
      printf 'DISMISS_ATTEMPTED_DIALOG_REMAINS\n' >> "$out/anr-dialog-recovery.txt"
    else
      printf 'DISMISS_ATTEMPTED_DIALOG_CLEARED_OR_UI_CHANGED\n' >> "$out/anr-dialog-recovery.txt"
      timeout 12s adb shell screencap -p /sdcard/mosharrof-recovery.png >/dev/null 2>&1 &&
        timeout 12s adb pull /sdcard/mosharrof-recovery.png "$out/apk-webview-after-anr-dismiss.png" >/dev/null 2>&1 || true
    fi
    timeout 8s adb shell rm -f /sdcard/mosharrof-recovery-ui.xml /sdcard/mosharrof-recovery.png >/dev/null 2>&1 || true
  else
    printf 'DISMISS_ATTEMPTED_UI_HIERARCHY_UNAVAILABLE\n' >> "$out/anr-dialog-recovery.txt"
  fi
}
