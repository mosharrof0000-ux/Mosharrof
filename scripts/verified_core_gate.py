#!/usr/bin/env python3
"""Validate locked-file hashes and the isolated Jackbox module registry."""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "core" / "verified-core" / "locked-files.json"
REGISTRY = ROOT / "core" / "jackbox" / "registry.json"


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
        evidence = entry.get("evidence")
        if not isinstance(evidence, dict):
            errors.append(f"{path}: evidence object is required before a file can be locked")
            continue
        verified_commit = evidence.get("verified_commit")
        if not isinstance(verified_commit, str) or len(verified_commit) != 40 or any(c not in "0123456789abcdef" for c in verified_commit):
            errors.append(f"{path}: evidence.verified_commit must be a full commit SHA")
        test_runs = evidence.get("test_runs")
        if not isinstance(test_runs, list) or not test_runs or any(
            not isinstance(url, str) or not re.fullmatch(r"https://github\.com/[^/]+/[^/]+/actions/runs/[0-9]+", url)
            for url in test_runs
        ):
            errors.append(f"{path}: evidence.test_runs must contain verified GitHub Actions run URLs")
        for field in ("dependency_review", "acceptance"):
            value = evidence.get(field)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"{path}: evidence.{field} must explain the review")
        verified_at = evidence.get("verified_at")
        if not isinstance(verified_at, str) or not re.fullmatch(r"20[0-9]{2}-[0-9]{2}-[0-9]{2}", verified_at):
            errors.append(f"{path}: evidence.verified_at must be an ISO date")
        target = root / path
        if target.is_symlink():
            errors.append(f"{path}: symbolic links cannot be locked")
            continue
        try:
            target.resolve(strict=True).relative_to(root.resolve(strict=True))
        except (OSError, ValueError):
            errors.append(f"{path}: locked file is missing or resolves outside the repository")
            continue
        if not target.is_file():
            errors.append(f"{path}: locked path is not a regular file")
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
        errors.append("core/jackbox/registry.json: schema_version must be 1")
    modules = data.get("modules")
    if not isinstance(modules, list):
        return errors + ["core/jackbox/registry.json: modules must be a list"]
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
        expected_dir = f"organs/{module_id}"
        expected_entry = f"{expected_dir}/index.js"
        if module_dir != expected_dir:
            errors.append(f"{module_id}: path must be {expected_dir}")
        if entry != expected_entry:
            errors.append(f"{module_id}: entry must be {expected_entry}")
        else:
            target = root / entry
            manifest_path = root / expected_dir / "organ.json"
            if target.is_symlink() or manifest_path.is_symlink():
                errors.append(f"{module_id}: module entry and organ manifest cannot be symbolic links")
            elif not target.is_file() or not manifest_path.is_file():
                errors.append(f"{module_id}: organ index.js and organ.json must exist")
            else:
                try:
                    organ_manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                    target.resolve(strict=True).relative_to(root.resolve(strict=True))
                    manifest_path.resolve(strict=True).relative_to(root.resolve(strict=True))
                    if organ_manifest.get("id") != module_id:
                        errors.append(f"{module_id}: organ.json id must match the Jackbox module id")
                except (OSError, ValueError, json.JSONDecodeError, AttributeError) as exc:
                    errors.append(f"{module_id}: invalid organ manifest or path: {exc}")
    return errors


def manifest_paths(data: object, label: str) -> set[str]:
    if not isinstance(data, dict):
        raise ValueError(f"{label} must be a JSON object")
    entries = data.get("locked_files")
    if not isinstance(entries, list):
        raise ValueError(f"{label} locked_files must be a list")
    paths: set[str] = set()
    for index, item in enumerate(entries):
        if not isinstance(item, dict):
            raise ValueError(f"{label} locked_files[{index}] must be an object")
        path = safe_repo_path(item.get("path"))
        digest = item.get("sha256")
        if not isinstance(digest, str) or len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
            raise ValueError(f"{label} locked_files[{index}] has an invalid sha256")
        if path in paths:
            raise ValueError(f"{label} has duplicate locked path {path}")
        paths.add(path)
    return paths


def changed_paths(base_ref: str) -> list[str]:
    result = subprocess.run(
        ["git", "diff", "--name-only", "--diff-filter=ACDMRT", f"{base_ref}...HEAD"],
        cwd=ROOT, text=True, capture_output=True, check=True,
    )
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def locked_change_errors(base_locked: set[str], head_locked: set[str], changed: set[str]) -> list[str]:
    # Use both manifests: this blocks removing a lock and editing the file in one PR,
    # and blocks editing a file while adding its first lock entry in the same PR.
    blocked = sorted((base_locked | head_locked) & changed)
    return [f"locked file changed in this pull request: {path}" for path in blocked]


def validate_changed_locked_files(base_ref: str) -> list[str]:
    try:
        # Read the base manifest as well as the PR manifest. Otherwise a PR could
        # remove a lock entry and edit that file in the same change.
        manifest_exists = subprocess.run(
            ["git", "cat-file", "-e", f"{base_ref}:core/verified-core/locked-files.json"],
            cwd=ROOT, text=True, capture_output=True,
        ).returncode == 0
        if manifest_exists:
            base_manifest = subprocess.run(
                ["git", "show", f"{base_ref}:core/verified-core/locked-files.json"],
                cwd=ROOT, text=True, capture_output=True, check=True,
            )
            base_data = json.loads(base_manifest.stdout)
            base_locked = manifest_paths(base_data, "base manifest")
        else:
            # Bootstrap PR: no lock manifest existed on the base branch yet.
            base_locked = set()
        head_data = read_json(MANIFEST)
        head_locked = manifest_paths(head_data, "PR manifest")
        changed = set(changed_paths(base_ref))
    except (ValueError, json.JSONDecodeError, subprocess.CalledProcessError) as exc:
        return [f"cannot compare changed files against {base_ref}: {exc}"]
    return locked_change_errors(base_locked, head_locked, changed)


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
