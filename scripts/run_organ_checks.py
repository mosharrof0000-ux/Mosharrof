#!/usr/bin/env python3
"""Run the isolated-organ architecture and learning checks in the existing CI workflow."""
from __future__ import annotations
import subprocess
import sys

COMMANDS = [
    ["git", "fetch", "--no-tags", "origin", "main:refs/remotes/origin/main"],
    ["python3", "scripts/mosharrof_registry.py", "--validate-only"],
    ["python3", "scripts/mosharrof_architecture_gate.py", "origin/main"],
    ["node", "--experimental-default-type=module", "--test", "tests/architecture/organ-runtime.test.mjs"],
    ["node", "--experimental-default-type=module", "--test", "organs/user-preference-intelligence/tests/preference-intelligence.test.mjs"],
    ["node", "--experimental-default-type=module", "--test", "organs/continuous-learning-orchestrator/tests/continuous-learning.test.mjs"],
    ["python3", "-m", "unittest", "-v", "scripts/test_mosharrof_registry.py"],
    ["python3", "-m", "unittest", "-v", "scripts/test_mosharrof_architecture_gate.py"],
    ["python3", "-m", "unittest", "-v", "tests/test_continuous_learning_scan.py"],
]

def main() -> int:
    for command in COMMANDS:
        print("+", " ".join(command), flush=True)
        result = subprocess.run(command, check=False)
        if result.returncode:
            print(f"ORGAN CHECKS BLOCKED: exit {result.returncode}: {' '.join(command)}", file=sys.stderr)
            return result.returncode
    print("ORGAN CHECKS: PASS")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
