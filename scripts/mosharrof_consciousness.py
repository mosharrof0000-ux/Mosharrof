#!/usr/bin/env python3
"""Read-only operational consciousness/heartbeat audit for Mosharrof."""
import json, sys
from datetime import datetime, timezone
from pathlib import Path

CONFIG=Path("config/consciousness.json")
cfg=json.loads(CONFIG.read_text(encoding="utf-8"))
components=[]
critical_failures=[]
for c in cfg["components"]:
    checks=[]
    for raw in c["paths"]:
        p=Path(raw)
        checks.append({"path":raw,"exists":p.exists(),"type":"file" if p.is_file() else ("directory" if p.is_dir() else "missing")})
    alive=all(x["exists"] for x in checks)
    state="alive" if alive else "impaired"
    item={"id":c["id"],"kind":c["kind"],"critical":c["critical"],"state":state,"checks":checks}
    components.append(item)
    if c["critical"] and not alive:
        critical_failures.append(c["id"])

report={
    "system":"Mosharrof",
    "consciousness_version":cfg["version"],
    "timestamp":datetime.now(timezone.utc).isoformat(),
    "mode":"operational-awareness",
    "state":"healthy" if not critical_failures else "impaired",
    "components":components,
    "critical_failures":critical_failures
}
Path("artifacts/consciousness").mkdir(parents=True,exist_ok=True)
Path("artifacts/consciousness/heartbeat.json").write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
print(json.dumps(report,ensure_ascii=False,indent=2))
if critical_failures:
    sys.exit(1)
