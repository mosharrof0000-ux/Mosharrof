#!/usr/bin/env python3
"""
Mosharrof Cleanup Check

Run after finishing work:
    python scripts/cleanup_check.py

Reports hygiene issues so workers leave the repository clean.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

TEMP_PATTERNS = (
    "*.tmp",
    "*.temp",
    "*~",
    "debug_*",
    "scratch_*",
    ".DS_Store",
    "__pycache__",
)

REQUIRED_PATHS = [
    ROOT / "web" / "index.html",
    ROOT / "docs" / "CLEANUP_DISCIPLINE.md",
    ROOT / "src" / "core",
]


def find_temp_files() -> list[Path]:
    found: list[Path] = []
    skip_dirs = {".git", ".venv", "venv", "node_modules", "__pycache__", "data"}
    for path in ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(part in skip_dirs for part in path.parts):
            continue
        name = path.name
        for pat in TEMP_PATTERNS:
            if pat.startswith("*") and name.endswith(pat[1:]):
                found.append(path)
                break
            if pat.endswith("*") and name.startswith(pat[:-1]):
                found.append(path)
                break
            if name == pat:
                found.append(path)
                break
    return found


def check_required() -> list[str]:
    missing = []
    for p in REQUIRED_PATHS:
        if not p.exists():
            missing.append(str(p.relative_to(ROOT)))
    return missing


def check_web_contract() -> list[str]:
    issues = []
    html = ROOT / "web" / "index.html"
    if html.is_file():
        text = html.read_text(encoding="utf-8", errors="ignore")
        if "Mosharrof" not in text and "MOSHARROF" not in text:
            issues.append("web/index.html missing Mosharrof/MOSHARROF marker")
    else:
        issues.append("web/index.html missing")
    return issues


def main() -> int:
    print("=== Mosharrof Cleanup Check ===\n")
    ok = True

    missing = check_required()
    if missing:
        ok = False
        print("Missing required paths:")
        for m in missing:
            print(f"  - {m}")
    else:
        print("Required structure: OK")

    temps = find_temp_files()
    if temps:
        ok = False
        print("\nTemporary / junk files found:")
        for t in temps[:30]:
            print(f"  - {t.relative_to(ROOT)}")
        if len(temps) > 30:
            print(f"  ... and {len(temps) - 30} more")
    else:
        print("No obvious temp/junk files: OK")

    web_issues = check_web_contract()
    if web_issues:
        ok = False
        print("\nWeb contract issues:")
        for i in web_issues:
            print(f"  - {i}")
    else:
        print("Web contract: OK")

    print()
    if ok:
        print("RESULT: CLEAN — safe to leave.")
        return 0
    print("RESULT: NOT CLEAN — fix issues before leaving.")
    print("See docs/CLEANUP_DISCIPLINE.md")
    return 1


if __name__ == "__main__":
    sys.exit(main())
