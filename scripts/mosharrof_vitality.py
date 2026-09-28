#!/usr/bin/env python3
"""Operational vitality audit for every registered Mosharrof entity.

This is not a claim of literal consciousness. It is the machine-checkable
"chaitanya" layer: every registered entity must have a complete identity,
brain assignment, responsibility, memory/tool/audit boundaries, permission,
policy and scope before the autonomous engine proceeds.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
REQUIRED_ENTITY_FIELDS = {"id","type","owner","name","responsibility","brain","scope","permission_profile","memory","tools","audit","delete_allowed"}
CONTRACT_FIELDS = {"identity","brain","memory","responsibility","permission","policy","scope","tools","communication","audit","version"}

def _read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))

def audit_entities(root: Path = ROOT) -> dict[str, Any]:
    manifest = _read_json(root / "config/project_manifest.json")
    registry = _read_json(root / "config/entity_registry.json")
    policy = _read_json(root / "config/policy.json")
    profiles = _read_json(root / "config/permission_profiles.json")
    model_registry = _read_json(root / "config/model_registry.json")
    errors: list[str] = []
    expected_contract = set(manifest.get("entity_contract", []))
    missing_contract = sorted(CONTRACT_FIELDS - expected_contract)
    if missing_contract:
        errors.append("manifest missing entity contract fields: " + ", ".join(missing_contract))
    global_policy = policy.get("global_policy", {})
    for key in ("delete_allowed","destructive_operations_allowed","scope_escape_allowed","automatic_activation_without_tests"):
        if global_policy.get(key) is not False:
            errors.append(f"global policy is not locked to false: {key}")
    entities = registry.get("entities", [])
    if not entities:
        errors.append("entity registry is empty")
    known_profiles = set(profiles.get("profiles", {}))
    vitality = []
    for entity in entities:
        entity_id = str(entity.get("id", "<missing-id>"))
        missing = sorted(REQUIRED_ENTITY_FIELDS - set(entity))
        checks = {
            "identity": bool(entity.get("id") and entity.get("name") and entity.get("owner")),
            "brain": bool(entity.get("brain")),
            "responsibility": bool(entity.get("responsibility")),
            "memory_boundary": bool(entity.get("memory")),
            "tool_boundary": bool(entity.get("tools")),
            "permission": entity.get("permission_profile") in known_profiles,
            "policy": entity.get("delete_allowed") is False,
            "scope": bool(entity.get("scope")),
            "audit_boundary": bool(entity.get("audit")),
            "versioned_contract": bool(registry.get("schema_version")),
        }
        if missing:
            errors.append(f"{entity_id}: missing fields: {', '.join(missing)}")
        for check, ok in checks.items():
            if not ok:
                errors.append(f"{entity_id}: vitality check failed: {check}")
        vitality.append({"id":entity_id,"name":entity.get("name"),"status":"ALIVE" if all(checks.values()) and not missing else "BLOCKED","checks":checks})
    if not (root / "src/core/brain_adapter.py").is_file():
        errors.append("brain adapter is missing")
    if "strategy" not in model_registry:
        errors.append("model registry strategy is missing")
    status = "ALIVE" if not errors else "BLOCKED"
    return {"schema_version":"1.0.0","system":"mosharrof.entity-vitality","meaning":"Operational chaitanya/heartbeat audit; not a claim of literal consciousness.","status":status,"entity_count":len(entities),"alive_count":sum(x["status"]=="ALIVE" for x in vitality),"blocked_count":sum(x["status"]=="BLOCKED" for x in vitality),"entities":vitality,"errors":errors}

def main() -> int:
    report = audit_entities()
    out = ROOT / "artifacts/vitality/entity-vitality.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["status"] == "ALIVE" else 1

if __name__ == "__main__":
    raise SystemExit(main())
