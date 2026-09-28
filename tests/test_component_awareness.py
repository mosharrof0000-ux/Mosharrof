"""Tests for Mosharrof component awareness."""
import json, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def test_component_awareness_covers_every_registered_entity():
    registry=json.loads((ROOT/"config/entity_registry.json").read_text(encoding="utf-8"))
    result=subprocess.run([sys.executable,"scripts/component_awareness.py"],cwd=ROOT,capture_output=True,text=True)
    assert result.returncode==0,result.stdout+result.stderr
    report=json.loads((ROOT/"artifacts/component-awareness/awareness.json").read_text(encoding="utf-8"))
    assert {e["id"] for e in registry["entities"]}=={e["id"] for e in report["components"]}
    assert report["system_state"]=="healthy"
    assert report["safety"]["all_components_explicitly_non_deletable"] is True
