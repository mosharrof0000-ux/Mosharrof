from pathlib import Path
import json, os, subprocess, sys

ROOT = Path(__file__).resolve().parents[1]

def test_awareness_config_registers_core_components():
    cfg = json.loads((ROOT / "config/system_awareness.json").read_text(encoding="utf-8"))
    ids = {c["id"] for c in cfg["components"]}
    assert {"frontend","autonomous-engine","visual-qa","verification-gate","pages-deploy","ci","security","documentation"} <= ids

def test_awareness_script_reports_healthy_repository(tmp_path):
    report = tmp_path / "report.json"
    request = tmp_path / "request.txt"
    env = dict(os.environ, AWARENESS_REPORT_FILE=str(report), AWARENESS_REQUEST_FILE=str(request))
    result = subprocess.run(
        [sys.executable, "scripts/mosharrof_system_awareness.py"],
        cwd=ROOT, env=env, capture_output=True, text=True, check=True
    )
    assert "HEALTHY" in result.stdout
    data = json.loads(report.read_text(encoding="utf-8"))
    assert data["state"] == "healthy"
    assert request.read_text(encoding="utf-8") == ""
