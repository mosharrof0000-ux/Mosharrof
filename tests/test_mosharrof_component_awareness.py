import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def test_component_awareness_is_complete():
    registry = json.loads((ROOT / "config/mosharrof_component_awareness.json").read_text())
    ids = [c["id"] for c in registry["components"]]
    assert len(ids) == len(set(ids))
    assert ids
    result = subprocess.run(
        [sys.executable, "scripts/mosharrof_component_awareness.py"],
        cwd=ROOT, capture_output=True, text=True
    )
    assert result.returncode == 0, result.stdout + result.stderr
    report = json.loads(result.stdout)
    assert report["overall_state"] == "ready"
    assert all(item["state"] == "ready" for item in report["components"])
