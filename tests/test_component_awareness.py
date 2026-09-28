import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def test_component_awareness_registry_is_complete():
    registry = json.loads((ROOT / "config/mosharrof_consciousness.json").read_text(encoding="utf-8"))
    components = registry["components"]
    assert components
    ids = [c["id"] for c in components]
    assert len(ids) == len(set(ids))
    for component in components:
        assert component["id"]
        assert component["path"]
        assert component["kind"]
        assert (ROOT / component["path"]).is_file()

def test_component_awareness_audit_passes():
    result = subprocess.run(
        [sys.executable, "scripts/mosharrof_consciousness.py"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    report = json.loads(result.stdout)
    assert report["healthy"] is True
    assert report["healthy_count"] == report["component_count"]
