#!/usr/bin/env python3
"""Mosharrof system-awareness and safe self-healing request generator."""
import json, os
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "config/system_awareness.json"
REQUEST_OUT = Path(os.environ.get("AWARENESS_REQUEST_FILE", "/tmp/awareness_request.txt"))
REPORT_OUT = Path(os.environ.get("AWARENESS_REPORT_FILE", "/tmp/awareness_report.json"))

cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
issues = []
states = []

for component in cfg["components"]:
    missing = [p for p in component["paths"] if not (ROOT / p).exists()]
    state = "healthy" if not missing else "attention"
    states.append({"id": component["id"], "state": state, "missing_paths": missing})
    issues.extend(f"{component['id']}: missing required path {p}" for p in missing)

html_path = ROOT / "web/index.html"
html = html_path.read_text(encoding="utf-8") if html_path.exists() else ""
for token in ("MOSHARROF AI", 'class="header"', 'class="messages"', 'class="composer"',
              'class="drawer-left"', 'class="drawer-right"'):
    if token not in html:
        issues.append(f"frontend: missing contract {token}")

engine = (ROOT / "scripts/mosharrof_autonomous_engine.py").read_text(encoding="utf-8")
for token in ('"gh", "pr", "create"', '"gh", "pr", "merge"', '"--auto"', '"--squash"'):
    if token not in engine:
        issues.append(f"autonomous-engine: missing protected promotion contract {token}")

report = {
    "system": cfg["name"], "version": cfg["version"],
    "enabled": cfg["enabled"],
    "state": "attention" if issues else "healthy",
    "components": states, "issues": issues
}
REPORT_OUT.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

if issues:
    request = """Mosharrof system-awareness detected safe-to-repair issues.
Repair only the listed defects. Never delete, force-push, alter secrets/protection,
or bypass the isolated-branch/PR pipeline. Preserve existing features.

Detected issues:
""" + "\n".join(f"- {x}" for x in issues)
    REQUEST_OUT.write_text(request, encoding="utf-8")
    print("ATTENTION")
    print("\n".join(issues))
else:
    REQUEST_OUT.write_text("", encoding="utf-8")
    print("HEALTHY")
