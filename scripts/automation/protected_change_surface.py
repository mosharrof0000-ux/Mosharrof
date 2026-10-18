#!/usr/bin/env python3
"""Fail closed when an autonomous working-tree patch touches protected files or adds destructive commands."""
import re
import subprocess
import sys

def git(*args):
    result = subprocess.run(["git", *args], check=True, text=True, capture_output=True)
    return result.stdout

try:
    changed = set(git("diff", "--name-only", "HEAD").splitlines())
    protected = re.compile(r"^\.github/workflows/(deploy-pages|verification-gate)\.yml$|^CODEOWNERS$")
    blocked = sorted(path for path in changed if protected.search(path))
    if blocked:
        print("Protected deployment/security file modified: " + ", ".join(blocked), file=sys.stderr)
        sys.exit(1)

    diff = git("diff", "--unified=0", "HEAD", "--", ".")
    destructive = re.compile(r"^\+[^+].*(?:rm -rf|git push --force|git reset --hard|gh repo delete|delete-repository)", re.I)
    hits = [line for line in diff.splitlines() if destructive.search(line)]
    if hits:
        print("Destructive operation detected in added lines:", file=sys.stderr)
        print("\n".join(hits), file=sys.stderr)
        sys.exit(1)
except subprocess.CalledProcessError as exc:
    print(f"Unable to inspect current patch safely: {exc}", file=sys.stderr)
    sys.exit(2)

print("Protected change-surface check: PASS")
