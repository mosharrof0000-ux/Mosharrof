#!/usr/bin/env bash
set -euo pipefail

python - <<'PY'
from pathlib import Path
path = Path("android/app/src/main/java/com/mosharrof/ai/MainActivity.java")
source = path.read_text(encoding="utf-8")
replacements = [
    (
        "    private static boolean askedForOverlayThisSession = false;\n",
        "    private static boolean askedForOverlayThisSession = false;\n    private boolean disableVoiceOverlayForTest = false;\n",
    ),
    (
        "        super.onCreate(savedInstanceState);\n",
        "        super.onCreate(savedInstanceState);\n        disableVoiceOverlayForTest = getIntent().getBooleanExtra(\"mosharrof_disable_voice_overlay\", false);\n",
    ),
    (
        "        beginPermissionSetup();\n",
        "        if (!disableVoiceOverlayForTest) beginPermissionSetup();\n",
    ),
    (
        "        if (Settings.canDrawOverlays(this)) startVoiceOverlay();\n",
        "        if (!disableVoiceOverlayForTest && Settings.canDrawOverlays(this)) startVoiceOverlay();\n",
    ),
    (
        "    private void continueOverlaySetup() {\n",
        "    private void continueOverlaySetup() {\n        if (disableVoiceOverlayForTest) return;\n",
    ),
    (
        "        if (requestCode == OVERLAY_REQUEST && Settings.canDrawOverlays(this)) startVoiceOverlay();\n",
        "        if (!disableVoiceOverlayForTest && requestCode == OVERLAY_REQUEST && Settings.canDrawOverlays(this)) startVoiceOverlay();\n",
    ),
]
for old, new in replacements:
    if old not in source:
        if new in source:
            continue
        raise SystemExit(f"Expected MainActivity anchor missing: {old.strip()}")
    source = source.replace(old, new, 1)
path.write_text(source, encoding="utf-8")
assert 'getBooleanExtra("mosharrof_disable_voice_overlay", false)' in source
assert "if (!disableVoiceOverlayForTest) beginPermissionSetup();" in source
print("Android WebView smoke isolation mode: PASS")
PY
