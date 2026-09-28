#!/usr/bin/env python3
"""Deterministic component-awareness check for Mosharrof.

This is operational self-awareness, not a claim of subjective consciousness.
It makes each registered component observable through state, dependencies,
capabilities and explicit failure reasons.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "config" / "mosharrof_component_awareness.json"
VALID_STATES = {"ready", "degraded", "blocked"}

def inspect(component):
    path = ROOT / component["path"]
    exists = path.exists()
    if not exists:
        return {"id": component["id"], "state": "blocked", "path": component["path"],
                "capabilities": [], "dependencies": component["depends_on"],
                "error": "required path is missing"}
    if path.is_file() and path.stat().st_size == 0:
        return {"id": component["id"], "state": "degraded", "path": component["path"],
                "capabilities": [], "dependencies": component["depends_on"],
                "error": "component file is empty"}
    caps = ["presence", "path-integrity"]
    if component["kind"] in {"agent", "orchestrator"}:
        caps += ["execution", "coordination"]
    if component["kind"] == "verification":
        caps += ["verification", "failure-reporting"]
    if component["kind"] == "interface":
        caps += ["user-interface"]
    if component["kind"] == "deployment":
        caps += ["deployment"]
    if component["kind"] == "health-check":
        caps += ["health-observation"]
    return {"id": component["id"], "state": "ready", "path": component["path"],
            "capabilities": caps, "dependencies": component["depends_on"], "error": None}

def main():
    data = json.loads(REGISTRY.read_text(encoding="utf-8"))
    results = [inspect(c) for c in data["components"]]
    ids = {r["id"] for r in results}
    for r, c in zip(results, data["components"]):
        missing = [d for d in c["depends_on"] if d not in ids]
        if missing:
            r["state"] = "blocked"
            r["error"] = "unknown dependencies: " + ", ".join(missing)
    summary = {
        "system": data["name"],
        "version": data["version"],
        "overall_state": "ready" if all(r["state"] == "ready" for r in results) else "degraded",
        "components": results
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    if summary["overall_state"] != "ready":
        return 1
    return 0

if __name__ == "__main__":
    sys.exit(main())
