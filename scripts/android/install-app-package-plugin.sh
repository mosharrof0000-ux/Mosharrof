#!/usr/bin/env bash
set -euo pipefail

test -f android/app/src/main/AndroidManifest.xml
cp native/android/AppPackagePlugin.java android/app/src/main/java/com/mosharrof/ai/AppPackagePlugin.java

python3 - <<'PY'
from pathlib import Path

path = Path("android/app/src/main/AndroidManifest.xml")
xml = path.read_text(encoding="utf-8")
application = "<application"
if application not in xml:
    raise SystemExit("Generated Android manifest has no application element")

permission = '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />'
if permission not in xml:
    xml = xml.replace(application, permission + "\n    " + application, 1)

launcher_query = """<intent>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent>"""
if "<queries" not in xml:
    xml = xml.replace(application, "<queries>\n        " + launcher_query + "\n    </queries>\n    " + application, 1)
elif "android.intent.category.LAUNCHER" not in xml:
    xml = xml.replace("</queries>", "    " + launcher_query + "\n    </queries>", 1)

path.write_text(xml, encoding="utf-8")
if permission not in xml or "android.intent.category.LAUNCHER" not in xml:
    raise SystemExit("Package install permission / package visibility query injection failed")
PY

grep -q 'REQUEST_INSTALL_PACKAGES' android/app/src/main/AndroidManifest.xml
grep -q 'android.intent.category.LAUNCHER' android/app/src/main/AndroidManifest.xml
test -s android/app/src/main/java/com/mosharrof/ai/AppPackagePlugin.java
echo "Native app package plugin + manifest contract: PASS"
