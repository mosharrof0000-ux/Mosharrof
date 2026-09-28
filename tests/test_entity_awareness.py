import json, subprocess, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def test_entity_registry_contract():
    r=json.loads((ROOT/"config/entity_registry.json").read_text(encoding="utf-8"))
    required={"id","type","owner","name","responsibility","brain","scope","permission_profile","memory","tools","audit","delete_allowed"}
    assert r["entities"] and all(required <= set(e) and e["delete_allowed"] is False for e in r["entities"])
def test_awareness_runtime_is_healthy():
    x=subprocess.run([sys.executable,"scripts/entity_awareness.py"],cwd=ROOT,capture_output=True,text=True)
    assert x.returncode==0,x.stderr
    report=json.loads((ROOT/"artifacts/entity-awareness.json").read_text(encoding="utf-8"))
    assert report["status"]=="awake"
    assert report["entity_count"]==report["healthy_entities"]
