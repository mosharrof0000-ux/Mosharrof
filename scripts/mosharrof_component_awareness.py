#!/usr/bin/env python3
"""Deterministic component-awareness/heartbeat check for Mosharrof.

This is operational awareness, not a claim of human-like consciousness.
It inventories registered components, reports their measurable state, and
gives recovery guidance without modifying or deleting project data.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config" / "component_awareness.json"

def main():
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    report = {"system": cfg["name"], "version": cfg["version"], "components": [], "summary": {}}
    counts = {state: 0 for state in cfg["states"]}

    for item in cfg["components"]:
        target = ROOT / item["path"]
        if target.is_file() or target.is_dir():
            state = "healthy"
            detail = "present"
            recovery = "none"
        else:
            state = "offline"
            detail = "required component path is missing"
            recovery = f"restore or recreate {item['path']} on an isolated branch"
        counts[state] += 1
        report["components"].append({
            "id": item["id"], "role": item["role"], "path": item["path"],
            "state": state, "detail": detail, "recovery": recovery
        })

    report["summary"] = counts
    report["overall"] = "healthy" if counts["offline"] == 0 else "degraded"
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if counts["offline"]:
        raise SystemExit(1)

if __name__ == "__main__":
    main()
