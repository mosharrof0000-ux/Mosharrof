import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def test_consciousness_registry_is_valid():
    data = json.loads((ROOT / "config/system_consciousness.json").read_text(encoding="utf-8"))
    assert data["organs"]
    assert all(item["id"] and item["paths"] for item in data["organs"])

def test_consciousness_audit_passes():
    result = subprocess.run(
        [sys.executable, "scripts/system_consciousness.py"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    report = json.loads(result.stdout)
    assert report["status"] == "PASS"
