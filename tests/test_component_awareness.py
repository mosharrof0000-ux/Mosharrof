from pathlib import Path
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]

def test_component_awareness_registry_and_heartbeat():
    cfg = json.loads((ROOT / "config/component_awareness.json").read_text())
    assert cfg["policy"]["no_delete"] is True
    assert cfg["policy"]["no_direct_main_write"] is True
    assert len(cfg["components"]) >= 7
    result = subprocess.run(
        [sys.executable, "scripts/mosharrof_component_awareness.py"],
        cwd=ROOT, capture_output=True, text=True, check=True,
    )
    report = json.loads(result.stdout)
    assert report["overall"] == "healthy"
    assert report["summary"]["offline"] == 0
