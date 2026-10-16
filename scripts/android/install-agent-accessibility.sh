#!/usr/bin/env bash
set -euo pipefail
mkdir -p android/app/src/main/java/com/mosharrof/ai android/app/src/main/res/xml
cp native/android/AgentAccessibilityService.java android/app/src/main/java/com/mosharrof/ai/AgentAccessibilityService.java
cp native/android/agent_accessibility_service.xml android/app/src/main/res/xml/agent_accessibility_service.xml
python3 - <<'PY'
from pathlib import Path
p = Path("android/app/src/main/AndroidManifest.xml")
s = p.read_text(encoding="utf-8")
service = '''        <service
            android:name="com.mosharrof.ai.AgentAccessibilityService"
            android:label="MOSHARROF AI device assistant"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
            android:exported="true">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/agent_accessibility_service" />
        </service>
'''
if "com.mosharrof.ai.AgentAccessibilityService" not in s:
    s = s.replace("</application>", service + "    </application>")
p.write_text(s, encoding="utf-8")
strings = Path("android/app/src/main/res/values/strings.xml")
content = strings.read_text(encoding="utf-8") if strings.exists() else '<resources>\n</resources>\n'
if "agent_accessibility_description" not in content:
    content = content.replace("</resources>", '    <string name="agent_accessibility_description">MOSHARROF AI reads visible interface labels and performs explicitly requested label-based taps or scrolling. It does not read password fields or autonomously approve payments.</string>\n</resources>')
strings.parent.mkdir(parents=True, exist_ok=True)
strings.write_text(content, encoding="utf-8")
PY
