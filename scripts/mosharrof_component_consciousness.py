#!/usr/bin/env python3
"""Deterministic component-consciousness audit for Mosharrof.

This is a health/awareness check, not a claim of human-like consciousness.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
cfg = json.loads((ROOT / "config" / "component_consciousness.json").read_text(encoding="utf-8"))

checks = {
    "header": 'class="header"' in HTML,
    "brand": 'class="brand"' in HTML,
    "theme-engine": "function applyTheme" in HTML and "setInterval" in HTML,
    "chat": 'class="chat"' in HTML,
    "messages": 'id="messages"' in HTML and 'class="messages"' in HTML,
    "message-renderer": 'class="message ai"' in HTML or 'class="message user"' in HTML,
    "quick-actions": 'class="quick"' in HTML,
    "composer": 'class="composer"' in HTML,
    "drawer-left": 'class="drawer-left"' in HTML,
    "drawer-right": 'class="drawer-right"' in HTML,
    "scrim": 'class="scrim"' in HTML,
    "send-input": 'id="input"' in HTML and 'id="send"' in HTML,
    "autonomous-engine": (ROOT / "scripts" / "mosharrof_autonomous_engine.py").exists(),
    "visual-qa": (ROOT / "scripts" / "mosharrof_visual_qa.mjs").exists(),
    "verification-gate": (ROOT / ".github" / "workflows" / "verification-gate.yml").exists(),
    "pages-deploy": (ROOT / ".github" / "workflows" / "deploy-pages.yml").exists(),
    "live-health-check": "health" in (ROOT / ".github" / "workflows" / "deploy-pages.yml").read_text(encoding="utf-8").lower(),
}
bad = [name for name, ok in checks.items() if not ok]
unknown = [name for name in cfg["components"] if name not in checks]
if unknown:
    raise SystemExit("Unregistered audit target(s): " + ", ".join(unknown))
if bad:
    raise SystemExit("Component consciousness audit failed: " + ", ".join(bad))
print(json.dumps({"status":"HEALTHY","components_checked":len(checks),"missing":[]}, ensure_ascii=False))
