#!/usr/bin/env python3
"""Deterministic health audit for every registered Mosharrof production organ."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY = ROOT / "config/system_consciousness.json"

def audit():
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    results = []
    for organ in registry["organs"]:
        missing = [p for p in organ["paths"] if not (ROOT / p).exists()]
        results.append({
            "id": organ["id"],
            "status": "PASS" if not missing else "FAIL",
            "missing": missing,
            "checks": organ["checks"],
        })
    return {
        "system": registry["name"],
        "version": registry["version"],
        "status": "PASS" if all(x["status"] == "PASS" for x in results) else "FAIL",
        "organs": results,
    }

if __name__ == "__main__":
    report = audit()
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report["status"] == "PASS" else 1)
