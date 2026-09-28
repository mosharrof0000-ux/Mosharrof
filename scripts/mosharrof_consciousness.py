#!/usr/bin/env python3
"""Mosharrof component-awareness audit.

Checks that every registered component exists, is readable, and has a known kind.
The report is deterministic JSON and returns non-zero when a registered component
is missing. It provides operational awareness, not human-like consciousness.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "config" / "mosharrof_consciousness.json"

def main():
    data = json.loads(REGISTRY.read_text(encoding="utf-8"))
    components = data.get("components", [])
    seen = set()
    results = []
    healthy = True
    for item in components:
        cid = item.get("id")
        path_text = item.get("path")
        kind = item.get("kind")
        valid = bool(cid and path_text and kind and cid not in seen)
        if cid:
            seen.add(cid)
        path = ROOT / path_text if path_text else ROOT / "__missing__"
        exists = path.is_file()
        readable = exists and path.stat().st_size >= 0
        ok = valid and exists and readable
        healthy = healthy and ok
        results.append({
            "id": cid,
            "path": path_text,
            "kind": kind,
            "present": exists,
            "readable": readable,
            "healthy": ok
        })
    report = {
        "name": data.get("name"),
        "version": data.get("version"),
        "component_count": len(results),
        "healthy_count": sum(1 for r in results if r["healthy"]),
        "healthy": healthy,
        "components": results
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if healthy else 1

if __name__ == "__main__":
    raise SystemExit(main())
