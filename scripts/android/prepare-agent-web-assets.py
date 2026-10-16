#!/usr/bin/env python3
"""Copy small Android-only agent modules and inject their script tags."""
from pathlib import Path

core = Path("core")
bundle = Path("android-web")
assets = (
    "android-file-manager-ui.js",
    "android-media-organizer-ui.js",
    "android-file-hash-scan.js",
    "android-file-manager.js",
    "android-accessibility-ui.js",
    "android-agent-planner.js",
    "android-agent-capabilities.js",
    "android-agent-executor-guards.js",
    "android-agent-executor-recovery.js",
    "android-agent-executor.js",
    "android-agent-recovery.js",
    "android-agent-memory.js",
    "android-agent-memory-ui.js",
    "android-agent-command-router.js",
)
for name in assets:
    source = core / name
    if not source.is_file() or source.stat().st_size == 0:
        raise SystemExit(f"Required Android agent asset missing: {source}")
    (bundle / name).write_bytes(source.read_bytes())

page = bundle / "index.html"
html = page.read_text(encoding="utf-8")
scripts = (
    "device-control.js",
    "android-file-hash-scan.js",
    "android-file-manager.js",
    "android-file-manager-ui.js",
    "android-media-organizer-ui.js",
    "android-accessibility-ui.js",
    "android-agent-planner.js",
    "android-agent-capabilities.js",
    "android-agent-executor-guards.js",
    "android-agent-executor-recovery.js",
    "android-agent-executor.js",
    "android-agent-recovery.js",
    "android-agent-memory.js",
    "android-agent-memory-ui.js",
    "android-agent-command-router.js",)
for script in scripts:
    tag = f'<script src="./{script}"></script>'
    if tag not in html:
        html = html.replace("</body>", tag + "\n</body>", 1)
if any(f'<script src="./{name}"></script>' not in html for name in scripts):
    raise SystemExit("Android agent script injection incomplete")
page.write_text(html, encoding="utf-8")
