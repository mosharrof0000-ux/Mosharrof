from pathlib import Path
import json, subprocess, sys
ROOT=Path(__file__).resolve().parents[1]
def test_awareness_registry_is_safe():
    d=json.loads((ROOT/"config/mosharrof_system_awareness.json").read_text(encoding="utf-8"))
    assert d["repair_boundary"]["direct_main_write"] is False
    assert d["repair_boundary"]["destructive_change"] is False
    assert d["repair_boundary"]["protected_pr_required"] is True
def test_awareness_audit_passes():
    r=subprocess.run([sys.executable,"scripts/mosharrof_system_awareness.py"],cwd=ROOT,capture_output=True,text=True)
    assert r.returncode==0, r.stdout+r.stderr
