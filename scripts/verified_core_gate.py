#!/usr/bin/env python3
"""Validate locked-file hashes and the isolated Jackbox module registry."""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "verified-core" / "locked-files.json"
REGISTRY = ROOT / "jackbox" / "registry.json"


def read_json(path: Path) -> dict:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"{path.relative_to(ROOT)}: cannot read valid JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise ValueError(f"{path.relative_to(ROOT)}: top level must be an object")
    return data


def safe_repo_path(raw: object) -> str:
    if not isinstance(raw, str) or not raw or "\\" in raw:
        raise ValueError(f"invalid repository-relative path: {raw!r}")
    p = PurePosixPath(raw)
    if p.is_absolute() or any(part in ("", ".", "..") for part in p.parts):
        raise ValueError(f"path must be relative and may not traverse directories: {raw!r}")
    return p.as_posix()


def validate_manifest(root: Path = ROOT) -> list[str]:
    errors: list[str] = []
    try:
        data = read_json(root / MANIFEST.relative_to(ROOT))
    except ValueError as exc:
        return [str(exc)]
    if data.get("schema_version") != 1:
        errors.append("locked-files.json: schema_version must be 1")
    entries = data.get("locked_files")
    if not isinstance(entries, list):
        return errors + ["locked-files.json: locked_files must be a list"]
    seen: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict):
            errors.append("locked-files.json: each locked_files entry must be an object")
            continue
        try:
            path = safe_repo_path(entry.get("path"))
        except ValueError as exc:
            errors.append(str(exc))
            continue
        if path in seen:
            errors.append(f"locked-files.json: duplicate locked path {path}")
            continue
        seen.add(path)
        digest = entry.get("sha256")
        if not isinstance(digest, str) or len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
            errors.append(f"{path}: sha256 must be 64 lowercase hexadecimal characters")
            continue
        target = root / path
        if not target.is_file():
            errors.append(f"{path}: locked file does not exist")
            continue
        actual = hashlib.sha256(target.read_bytes()).hexdigest()
        if actual != digest:
            errors.append(f"{path}: SHA-256 mismatch (expected {digest}, got {actual})")
    return errors


def validate_registry(root: Path = ROOT) -> list[str]:
    errors: list[str] = []
    try:
        data = read_json(root / REGISTRY.relative_to(ROOT))
    except ValueError as exc:
        return [str(exc)]
    if data.get("schema_version") != 1:
        errors.append("jackbox/registry.json: schema_version must be 1")
    modules = data.get("modules")
    if not isinstance(modules, list):
        return errors + ["jackbox/registry.json: modules must be a list"]
    seen: set[str] = set()
    for module in modules:
        if not isinstance(module, dict):
            errors.append("jackbox registry: each module must be an object")
            continue
        module_id = module.get("id")
        if not isinstance(module_id, str) or not module_id or any(c not in "abcdefghijklmnopqrstuvwxyz0123456789-" for c in module_id):
            errors.append(f"jackbox registry: invalid module id {module_id!r}")
            continue
        if module_id in seen:
            errors.append(f"jackbox registry: duplicate module id {module_id}")
        seen.add(module_id)
        if not isinstance(module.get("enabled"), bool):
            errors.append(f"{module_id}: enabled must be an explicit boolean")
        try:
            module_dir = safe_repo_path(module.get("path"))
            entry = safe_repo_path(module.get("entry"))
        except ValueError as exc:
            errors.append(f"{module_id}: {exc}")
            continue
        expected_dir = f"jackbox/modules/{module_id}"
        if module_dir != expected_dir:
            errors.append(f"{module_id}: path must be {expected_dir}")
        if entry == expected_dir or not entry.startswith(expected_dir + "/"):
            errors.append(f"{module_id}: entry must remain inside its own module directory")
        elif not (root / entry).is_file():
            errors.append(f"{module_id}: entry file does not exist: {entry}")
    return errors


def changed_paths(base_ref: str) -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--name-only", "--diff-filter=ACDMRT", f"{base_ref}...HEAD"],
        cwd=ROOT, text=True, capture_output=True, check=True,
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def validate_changed_locked_files(base_ref: str) -> list[str]:
    try:
        data = read_json(MANIFEST)
        locked = {
            safe_repo_path(item.get("path"))
            for item in data.get("locked_files", [])
            if isinstance(item, dict)
        }
        changed = set(changed_paths(base_ref))
    except (ValueError, subprocess.CalledProcessError) as exc:
        return [f"cannot compare changed files against {base_ref}: {exc}"]
    blocked = sorted(locked & changed)
    return [f"locked file changed in this pull request: {path}" for path in blocked]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-ref", help="Git ref used to detect changes to locked files")
    args = parser.parse_args()
    errors = validate_manifest() + validate_registry()
    if args.base_ref:
        errors += validate_changed_locked_files(args.base_ref)
    if errors:
        print("VERIFIED CORE / JACKBOX GATE: FAIL")
        for error in errors:
            print(f" - {error}")
        return 1
    print("VERIFIED CORE / JACKBOX GATE: PASS")
    print("Manifest and registry are valid; all declared locked-file hashes match.")
    if not read_json(MANIFEST).get("locked_files"):
        print("NOTICE: no application files are locked yet; pilot lock requires reviewed evidence.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
