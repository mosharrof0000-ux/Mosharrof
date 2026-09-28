#!/usr/bin/env python3
"""Deterministic Mosharrof system-awareness audit."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
CFG=json.loads((ROOT/"config/mosharrof_system_awareness.json").read_text(encoding="utf-8"))
results=[]
for c in CFG["components"]:
    missing=[p for p in c["paths"] if not (ROOT/p).exists()]
    results.append({"id":c["id"],"status":"healthy" if not missing else "attention","missing":missing})
engine=(ROOT/"scripts/mosharrof_autonomous_engine.py").read_text(encoding="utf-8")
safe=("gh", "pr", "create" in engine and "gh", "pr", "merge", branch, "--auto", "--squash" in engine and "git push --force" not in engine)
results.append({"id":"autonomous-safety-boundary","status":"healthy" if safe else "blocked","missing":[]})
report={"system":CFG["name"],"version":CFG["version"],"components":results,"healthy":all(x["status"]=="healthy" for x in results)}
print(json.dumps(report,ensure_ascii=False,indent=2))
raise SystemExit(0 if report["healthy"] else 1)
