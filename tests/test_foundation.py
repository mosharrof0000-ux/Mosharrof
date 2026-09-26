import json
from pathlib import Path

def test_project_manifest_and_entity_registry_are_machine_readable():
    root=Path(__file__).resolve().parents[1]
    manifest=json.loads((root/"config/project_manifest.json").read_text())
    registry=json.loads((root/"config/entity_registry.json").read_text())
    assert manifest["project"]["id"]=="mosharrof"
    assert manifest["capability_formula"]
    assert manifest["permanent_safety"]["delete"]=="DENY"
    assert registry["entities"][0]["id"]=="mosharrof-core"
    assert set(registry["required_entity_contract"]) >= {"identity","brain","memory","responsibility","permission","policy","tools","communication","audit","version"}
