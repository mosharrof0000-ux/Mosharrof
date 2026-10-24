from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ORGAN = ROOT / "organs" / "android-agent-bridge"


def test_android_agent_bridge_manifest_and_file_limits() -> None:
    manifest = json.loads((ORGAN / "organ.json").read_text(encoding="utf-8"))
    assert manifest["id"] == "android-agent-bridge"
    assert {"initialize", "tryAndroidAgentCommand", "consumeAndroidBridgeResult"} <= set(manifest["public_api"])
    source = (ORGAN / "index.js").read_text(encoding="utf-8")
    assert len(source.splitlines()) <= 250
    assert "mosharrof-device-command-v1" in source
    assert "mosharrof-device-result-v1" in source
    assert "crypto.subtle.sign" in source
    assert "crypto.subtle.verify" in source
    assert "mosharrof-agent://command" in source
    assert "mosharrof0000-ux.github.io" in source
    assert "localStorage" in source


def test_android_agent_bridge_javascript_module_syntax() -> None:
    node = shutil.which("node")
    if not node:
        return
    source = (ORGAN / "index.js").read_text(encoding="utf-8")
    checked = subprocess.run(
        [node, "--check", "--input-type=module"],
        input=source,
        text=True,
        capture_output=True,
        check=False,
    )
    assert checked.returncode == 0, checked.stderr
