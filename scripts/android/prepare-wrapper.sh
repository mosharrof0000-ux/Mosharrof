#!/usr/bin/env bash
set -euo pipefail

npm init -y
npm install --no-save @capacitor/core @capacitor/cli @capacitor/android
python3 scripts/prepare_web_organ_runtime.py
rm -rf android-web
cp -a web android-web
# Android-only CSS is copied into the temporary APK bundle, not the live Pages folder.
test -s core/android-edge-to-edge.css
cp core/android-edge-to-edge.css android-web/edge-to-edge.css
cp core/device-control.js android-web/device-control.js
python3 scripts/android/prepare-agent-web-assets.py
python3 scripts/android/inject-android-voice-bridge.py
grep -q 'edge-to-edge.css' android-web/index.html
grep -q 'mosharrof-android-header-hidden' android-web/index.html
grep -q '.top .brand { display:none !important; }' android-web/index.html
grep -q 'window.mosharrofNativeVoiceCommand' android-web/index.html
grep -q 'android-agent-command-router.js' android-web/index.html
grep -q 'routeAndroidAgentCommand' android-web/index.html
grep -q 'window.mosharrofAutoSpeakNext' android-web/index.html
npx cap init "MOSHARROF AI" "com.mosharrof.ai" --web-dir android-web
npx cap add android
npx cap sync android
