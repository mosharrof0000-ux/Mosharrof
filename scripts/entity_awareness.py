#!/usr/bin/env python3
"""Deterministic operational-awareness registry for Mosharrof entities."""
import json
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "config" / "entity_registry.json"
POLICY = ROOT / "config" / "entity_awareness.json"

def load_json(path):
    return json.loads(path.read_text(encoding="utf-8"))

def inspect():
    registry = load_json(REGISTRY)
    policy = load_json(POLICY)
    required = set(policy["required_facets"])
    results = []
    for entity in registry["entities"]:
        facets = {
            "identity": bool(entity.get("id") and entity.get("name")),
            "brain": bool(entity.get("brain")),
            "responsibility": bool(entity.get("responsibility")),
            "memory": bool(entity.get("memory")),
            "permissions": bool(entity.get("permission_profile")),
            "policy": True,
            "tools": bool(entity.get("tools")),
            "communication": True,
            "state": True,
            "health": True,
            "audit": bool(entity.get("audit")),
            "version": bool(registry.get("schema_version"))
        }
        missing = sorted(required - {k for k, ok in facets.items() if ok})
        results.append({
            "id": entity["id"],
            "name": entity.get("name", entity["id"]),
            "state": "ready" if not missing else "degraded",
            "scope": entity.get("scope", ""),
            "facets": facets,
            "missing": missing,
            "delete_allowed": entity.get("delete_allowed", True)
        })
    return {
        "system": policy["name"],
        "enabled": policy["enabled"],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "entity_count": len(results),
        "ready_count": sum(x["state"] == "ready" for x in results),
        "degraded_count": sum(x["state"] == "degraded" for x in results),
        "safety": policy["safety"],
        "entities": results
    }

if __name__ == "__main__":
    print(json.dumps(inspect(), ensure_ascii=False, indent=2))
