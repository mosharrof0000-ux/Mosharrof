#!/usr/bin/env python3
"""Fail-closed architecture gate for independently owned Mosharrof organs."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = sys.argv[1] if len(sys.argv) > 1 else "origin/main"
SOURCE_SUFFIXES = {".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".css", ".html"}
LINE_LIMITS = {
    ".js": 250, ".mjs": 250, ".cjs": 250, ".jsx": 250,
    ".ts": 250, ".tsx": 250, ".css": 350, ".html": 300,
}
IMPORT_RE = re.compile(
    r"""(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)["']([^"']+)["']"""
)
errors: list[str] = []


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def fail(message: str) -> None:
    errors.append(message)


def organ_name(path: str) -> str | None:
    parts = Path(path).parts
    return parts[1] if len(parts) > 1 and parts[0] == "organs" and not parts[1].startswith("_") else None


def is_policy_or_test(path: str) -> bool:
    p = Path(path)
    return p.parts[0] in {"scripts", "tests", "docs", ".github", "config"} or p.name.endswith((".test.js", ".spec.js", "_test.py"))


def resolve_import(source: Path, specifier: str) -> Path | None:
    if not specifier.startswith("."):
        return None
    target = (source.parent / specifier).resolve()
    candidates = [target, *(target.with_suffix(ext) for ext in (".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx")),
                  *(target / ("index" + ext) for ext in (".js", ".mjs", ".ts", ".tsx"))]
    for candidate in candidates:
        try:
            rel = candidate.relative_to(ROOT)
        except ValueError:
            continue
        if candidate.is_file():
            return rel
    return None


def main() -> int:
    try:
        changed = [p for p in git("diff", "--name-only", "--diff-filter=ACMR", f"{BASE}...HEAD").splitlines() if p]
    except subprocess.CalledProcessError as exc:
        print(f"ARCHITECTURE GATE: FAIL — cannot compare against {BASE}: {exc}", file=sys.stderr)
        return 2

    # The current legacy shell is frozen: new application logic must live in owned modules.
    if "web/index.html" in changed:
        fail("web/index.html is frozen legacy shell; migrate code into organs/ or core/ before editing it.")

    changed_organs = {name for path in changed if (name := organ_name(path))}
    for name in sorted(changed_organs):
        folder = ROOT / "organs" / name
        for required in ("organ.json", "index.js", "README.md", "tests/README.md"):
            if not (folder / required).is_file():
                fail(f"organ '{name}' is incomplete: missing organs/{name}/{required}")
        manifest = folder / "organ.json"
        if manifest.is_file():
            try:
                data = json.loads(manifest.read_text(encoding="utf-8"))
                if data.get("id") != name:
                    fail(f"{manifest.relative_to(ROOT)}: manifest id must equal '{name}'")
                if not isinstance(data.get("public_api"), list):
                    fail(f"{manifest.relative_to(ROOT)}: public_api must be an array")
            except (OSError, json.JSONDecodeError) as exc:
                fail(f"{manifest.relative_to(ROOT)} is not valid JSON: {exc}")

    for path in changed:
        p = Path(path)
        suffix = p.suffix.lower()
        if suffix not in SOURCE_SUFFIXES or is_policy_or_test(path):
            continue
        if not (p.parts[0] in {"organs", "core"}):
            fail(f"{path}: production source must belong to a dedicated organs/<organ>/ or core/ module.")
            continue
        full = ROOT / p
        if not full.is_file():
            fail(f"{path}: changed source file is missing from checkout.")
            continue
        lines = len(full.read_text(encoding="utf-8").splitlines())
        limit = LINE_LIMITS[suffix]
        if lines > limit:
            fail(f"{path}: {lines} lines exceeds the {limit}-line limit; split by responsibility.")
        current_organ = organ_name(path)
        if current_organ:
            for specifier in IMPORT_RE.findall(full.read_text(encoding="utf-8")):
                target = resolve_import(full, specifier)
                if target is None:
                    continue
                target_organ = organ_name(str(target))
                if target_organ and target_organ != current_organ:
                    fail(f"{path}: direct cross-organ import to {target}; use a declared public API/message contract.")
        # Each independently coded UI control must have its own module and a test.
        if "components" in p.parts and p.name.endswith((".js", ".jsx", ".ts", ".tsx")):
            if not current_organ:
                fail(f"{path}: UI component is not owned by an organ.")
            else:
                test_path = ROOT / "organs" / current_organ / "tests" / f"{p.stem}.test.js"
                if not test_path.is_file():
                    fail(f"{path}: dedicated component test is required at {test_path.relative_to(ROOT)}.")

    if errors:
        print("ARCHITECTURE GATE: FAIL")
        for error in errors:
            print(f" - {error}")
        print("No promotion is permitted while any architecture violation remains.")
        return 1

    print(json.dumps({
        "status": "PASS",
        "changed_files_checked": len(changed),
        "changed_organs_checked": sorted(changed_organs),
        "policy": "isolated organs; frozen legacy shell; enforced file-size limits; component tests",
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
