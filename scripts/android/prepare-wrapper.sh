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
cp core/android-file-manager-ui.js android-web/android-file-manager-ui.js
cp core/android-file-manager.js android-web/android-file-manager.js
cp core/android-accessibility-ui.js android-web/android-accessibility-ui.js
cp core/android-agent-planner.js android-web/android-agent-planner.js
cp core/android-agent-capabilities.js android-web/android-agent-capabilities.js
cp core/android-agent-executor.js android-web/android-agent-executor.js
cp core/android-agent-recovery.js android-web/android-agent-recovery.js
cp core/android-agent-memory.js android-web/android-agent-memory.js
cp core/android-agent-command-router.js android-web/android-agent-command-router.js
python - <<'PY'
from pathlib import Path
page = Path("android-web/index.html")
html = page.read_text(encoding="utf-8")
tag = '<script src="./device-control.js"></script>'
if tag not in html:
    html = html.replace("</body>", tag + "\n</body>", 1)
file_tag = '<script src="./android-file-manager.js"></script>'
if file_tag not in html:
    html = html.replace("</body>", file_tag + "\n</body>", 1)
ui_tag = '<script src="./android-file-manager-ui.js"></script>'
if ui_tag not in html:
    html = html.replace("</body>", ui_tag + "\n</body>", 1)
accessibility_tag = '<script src="./android-accessibility-ui.js"></script>'
if accessibility_tag not in html:
    html = html.replace("</body>", accessibility_tag + "\n</body>", 1)

agent_scripts = [
    "android-agent-planner.js",
    "android-agent-capabilities.js",
    "android-agent-executor.js",
    "android-agent-recovery.js",
    "android-agent-memory.js",
    "android-agent-command-router.js",
]
for script in agent_scripts:
    tag = f'<script src="./{script}"></script>'
    if tag not in html:
        html = html.replace("</body>", tag + "\n</body>", 1)
page.write_text(html, encoding="utf-8")
PY
python3 scripts/android/inject-wrapper-voice-bridge.py
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
