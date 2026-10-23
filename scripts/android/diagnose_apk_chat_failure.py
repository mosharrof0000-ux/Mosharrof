#!/usr/bin/env python3
"""Produce one independent, evidence-backed diagnosis for a failed APK real-chat run.

This tool diagnoses only; it never edits application code or claims the issue is fixed.
Each CI matrix lane focuses on one failure class and writes a machine-readable report.
"""
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

LANES = {
    "artifact": {
        "title": "APK artifact selection and integrity",
        "files": [".github/workflows/android-apk-webview-real-chat-qa.yml", ".github/workflows/build-apk.yml"],
        "patterns": [r"download", r"artifact", r"app-debug\.apk", r"headSha", r"run_id"],
    },
    "emulator": {
        "title": "Emulator boot, ADB, installation and launch",
        "files": ["scripts/android/run_apk_webview_smoke.sh"],
        "patterns": [r"sys\.boot_completed", r"adb install", r"am start", r"emulator", r"INSTALL_FAILED"],
    },
    "cdp": {
        "title": "WebView target and Chrome DevTools Protocol",
        "files": ["scripts/android/run_apk_webview_smoke.sh", "scripts/android/apk_webview_real_chat_smoke.py"],
        "patterns": [r"webview_devtools_remote", r"/json/list", r"webSocketDebuggerUrl", r"Page\.enable", r"websocket"],
    },
    "composer": {
        "title": "Chat composer discovery and prompt submission",
        "files": ["scripts/android/apk_webview_real_chat_smoke.py", "web/index.html"],
        "patterns": [r"#input", r"#sendBtn", r"synthetic_prompt_submitted", r"chat_composer_visible_in_apk"],
    },
    "backend": {
        "title": "Real backend response, network and provider fallback",
        "files": ["scripts/android/apk_webview_real_chat_smoke.py"],
        "patterns": [r"real_backend_returned_non_mock_answer", r"failed to fetch", r"quota exceeded", r"timeout-ms", r"data-provider"],
    },
    "evidence": {
        "title": "Screenshots, structured report and artifact retention",
        "files": [".github/workflows/android-apk-webview-real-chat-qa.yml", "scripts/android/apk_webview_real_chat_smoke.py", "scripts/android/run_apk_webview_smoke.sh"],
        "patterns": [r"upload-artifact", r"report\.json", r"apk-webview-before\.png", r"apk-webview-after\.png", r"apk-webview-failed\.png"],
    },
}

parser = argparse.ArgumentParser()
parser.add_argument("--lane", choices=sorted(LANES), required=True)
parser.add_argument("--log", default="artifacts/failure.log")
parser.add_argument("--output", default="artifacts/triage")
parser.add_argument("--run-id", default="")
parser.add_argument("--run-url", default="")
args = parser.parse_args()

lane = LANES[args.lane]
log_path = Path(args.log)
log = log_path.read_text(encoding="utf-8", errors="replace") if log_path.exists() else ""
root = Path(".")
checks = []
for relative in lane["files"]:
    path = root / relative
    exists = path.is_file()
    checks.append({
        "check": f"source_file:{relative}",
        "passed": exists,
        "evidence": f"exists={exists}",
    })
    if exists:
        source = path.read_text(encoding="utf-8", errors="replace")
        for pattern in lane["patterns"]:
            found = re.search(pattern, source, re.IGNORECASE) is not None
            checks.append({
                "check": f"source_contract:{relative}:{pattern}",
                "passed": found,
                "evidence": f"pattern_present={found}",
            })

log_patterns = {
    "artifact": [r"matching branch build", r"no artifact", r"not found", r"download", r"app-debug\.apk", r"test -s"],
    "emulator": [r"boot_completed", r"adb install", r"INSTALL_FAILED", r"device offline", r"emulator"],
    "cdp": [r"webview_devtools_remote", r"json/list", r"websocket", r"9222", r"target found"],
    "composer": [r"composer", r"#input", r"#sendBtn", r"prompt_submitted", r"not become visible"],
    "backend": [r"quota", r"failed to fetch", r"network error", r"timed out waiting for assistant", r"real_backend"],
    "evidence": [r"upload.*artifact", r"no files", r"report\.json", r"apk-webview-(before|after|failed)\.png"],
}
matched = []
for pattern in log_patterns[args.lane]:
    for match in re.finditer(pattern, log, re.IGNORECASE):
        line_start = log.rfind("\n", 0, match.start()) + 1
        line_end = log.find("\n", match.end())
        if line_end < 0:
            line_end = len(log)
        excerpt = log[line_start:line_end].strip()[:400]
        item = {"pattern": pattern, "excerpt": excerpt}
        if item not in matched:
            matched.append(item)
        break

out = Path(args.output)
out.mkdir(parents=True, exist_ok=True)
report = {
    "schema_version": 1,
    "lane": args.lane,
    "lane_title": lane["title"],
    "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    "triggering_run_id": args.run_id,
    "triggering_run_url": args.run_url,
    "diagnostic_only": True,
    "fix_applied": False,
    "log_available": bool(log),
    "log_bytes": len(log.encode("utf-8")),
    "source_checks": checks,
    "log_matches": matched,
    "interpretation": (
        "Evidence matches are diagnostic leads, not proof of root cause. "
        "Read the failed step and full logs before selecting a fix."
    ),
}
(out / f"{args.lane}.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
summary = [
    f"# Parallel failure triage: {lane['title']}",
    "",
    f"- Lane: `{args.lane}`",
    f"- Triggering run: {args.run_url or args.run_id or 'not supplied'}",
    f"- Failure log available: {'yes' if log else 'no'} ({len(log.encode('utf-8'))} bytes)",
    f"- Source contract checks: {sum(c['passed'] for c in checks)}/{len(checks)} present",
    f"- Relevant log matches: {len(matched)}",
    "- Fix applied: **no** (diagnostics only)",
    "",
    "## Relevant log excerpts",
]
if matched:
    summary.extend([f"- `{item['pattern']}`: `{item['excerpt']}`" for item in matched[:20]])
else:
    summary.append("- No lane-specific log patterns found. Inspect the full failure log.")
summary.extend(["", "## Source checks", ""])
summary.extend([f"- {'PASS' if c['passed'] else 'MISSING'} — `{c['check']}` ({c['evidence']})" for c in checks])
summary.extend(["", "## Interpretation", report["interpretation"], ""])
(out / f"{args.lane}.md").write_text("\n".join(summary), encoding="utf-8")
print(f"lane={args.lane} log_available={bool(log)} log_matches={len(matched)} checks={len(checks)}")
