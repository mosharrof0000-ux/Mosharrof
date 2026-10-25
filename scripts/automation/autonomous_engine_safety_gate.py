#!/usr/bin/env python3
"""Fail-closed safety gate for autonomous code promotion."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ENGINE = ROOT / "scripts/mosharrof_autonomous_engine.py"
LEGACY = ROOT / "scripts/autonomous_agent.py"


def main() -> int:
    checks = []
    for path, success_message in (
        (ENGINE, "PR created for review; automatic merge intentionally disabled"),
        (LEGACY, "PR opened for review; automatic merge intentionally disabled"),
    ):
        source = path.read_text(encoding="utf-8")
        checks.append((f"{path.relative_to(ROOT)} has no self-merge command",
                       '"gh", "pr", "merge"' not in source and '"gh","pr","merge"' not in source
                       and '"--auto"' not in source))
        checks.append((f"{path.relative_to(ROOT)} keeps review-only boundary",
                       success_message in source))
        checks.append((f"{path.relative_to(ROOT)} does not push directly to main",
                       '"git", "push", "origin", "main"' not in source
                       and '"git","push","origin","main"' not in source))
    failures = [name for name, passed in checks if not passed]
    result = {"gate": "autonomous-engine-safety", "status": "BLOCKED" if failures else "PASS",
              "checks": len(checks), "failures": failures}
    print(json.dumps(result, ensure_ascii=False))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
