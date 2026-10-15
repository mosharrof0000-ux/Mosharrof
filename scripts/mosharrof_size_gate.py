#!/usr/bin/env python3
"""Fail-closed file/folder size and growth gate for MOSHARROF AI.

Legacy over-budget files/folders are reported and may only remain unchanged or
shrink. New/changed in-budget source files must satisfy configured limits.
This script never edits or deletes project files.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
POLICY_PATH = ROOT / "config" / "file_folder_size_gate.json"


def git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=ROOT, check=True, text=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    ).stdout


def load_policy() -> dict:
    return json.loads(POLICY_PATH.read_text(encoding="utf-8"))


def excluded(path: str, policy: dict) -> bool:
    parts = Path(path).parts
    return (
        any(part in policy["excluded_path_parts"] for part in parts)
        or Path(path).name in policy["excluded_file_names"]
    )


def source_file(path: str, policy: dict) -> bool:
    return not excluded(path, policy) and Path(path).suffix.lower() in policy["source_extensions"]


def line_limit(path: str, policy: dict) -> int:
    """Use stricter language-specific caps before falling back to the general limit."""
    suffix = Path(path).suffix.lower()
    return policy.get("line_limits_by_extension", {}).get(suffix, policy["limits"]["max_file_lines"])


def add_folder_metrics(folders: dict, path: str, size: int) -> None:
    parent = str(Path(path).parent)
    while parent not in (".", ""):
        folders[parent][0] += size
        folders[parent][1] += 1
        parent = str(Path(parent).parent)


def current_metrics(policy: dict) -> tuple[dict, dict]:
    files = {}
    folders = defaultdict(lambda: [0, 0])
    for p in ROOT.rglob("*"):
        if not p.is_file():
            continue
        rel = p.relative_to(ROOT).as_posix()
        if not source_file(rel, policy):
            continue
        data = p.read_bytes()
        files[rel] = (len(data), len(data.splitlines()))
        add_folder_metrics(folders, rel, len(data))
    return files, {k: (v[0], v[1]) for k, v in folders.items()}


def base_metrics(base: str, policy: dict) -> tuple[dict, dict]:
    # Inspect the base tree without checking out or changing branches.
    entries = git("ls-tree", "-r", "-l", base).splitlines()
    files = {}
    folders = defaultdict(lambda: [0, 0])
    for entry in entries:
        try:
            meta, path = entry.split("\t", 1)
            _, kind, _, size_text = meta.split()
            if kind != "blob" or not source_file(path, policy):
                continue
            size = int(size_text)
            raw = subprocess.run(
                ["git", "show", f"{base}:{path}"], cwd=ROOT, check=True,
                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            ).stdout
            files[path] = (size, len(raw.splitlines()))
            add_folder_metrics(folders, path, size)
        except (ValueError, subprocess.CalledProcessError):
            raise RuntimeError(f"Unable to inspect base file entry: {entry[:160]}")
    return files, {k: (v[0], v[1]) for k, v in folders.items()}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, help="Git base ref, e.g. origin/main")
    args = parser.parse_args()
    policy = load_policy()
    limits = policy["limits"]
    try:
        base_files, base_folders = base_metrics(args.base, policy)
        head_files, head_folders = current_metrics(policy)
        changed = set(git("diff", "--name-only", "--diff-filter=ACMR", f"{args.base}...HEAD").splitlines())
    except (subprocess.CalledProcessError, RuntimeError) as exc:
        print(f"SIZE GATE BLOCKED: could not verify repository/base: {exc}", file=sys.stderr)
        return 2

    errors, warnings = [], []
    for path in sorted(changed):
        if not source_file(path, policy) or path not in head_files:
            continue
        size, lines = head_files[path]
        old_size, old_lines = base_files.get(path, (0, 0))
        per_type_line_limit = line_limit(path, policy)
        was_oversized = old_size > limits["max_file_bytes"] or old_lines > per_type_line_limit
        is_oversized = size > limits["max_file_bytes"] or lines > per_type_line_limit
        if was_oversized:
            if size > old_size or lines > old_lines:
                errors.append(f"{path}: legacy oversized file grew ({old_size}B/{old_lines} lines -> {size}B/{lines} lines); split/refactor first")
            elif is_oversized:
                warnings.append(f"{path}: legacy oversized file did not grow; schedule a safe refactor")
        elif is_oversized:
            errors.append(f"{path}: file budget exceeded ({size}B/{lines} lines; limits {limits['max_file_bytes']}B/{per_type_line_limit} lines for {Path(path).suffix.lower() or 'extensionless'} files)")
        elif old_size and size > old_size * (1 + limits["max_changed_file_growth_percent"] / 100):
            errors.append(f"{path}: file grew by more than {limits['max_changed_file_growth_percent']}% ({old_size}B -> {size}B); split/refactor or justify in a reviewed policy change")

    changed_folders = set()
    for path in changed:
        if source_file(path, policy):
            parent = str(Path(path).parent)
            while parent not in (".", ""):
                changed_folders.add(parent)
                parent = str(Path(parent).parent)
    for folder in sorted(changed_folders):
        size, count = head_folders.get(folder, (0, 0))
        old_size, old_count = base_folders.get(folder, (0, 0))
        over = size > limits["max_folder_source_bytes"] or count > limits["max_folder_source_files"]
        old_over = old_size > limits["max_folder_source_bytes"] or old_count > limits["max_folder_source_files"]
        if old_over:
            if size > old_size or count > old_count:
                errors.append(f"{folder}/: legacy oversized folder grew ({old_size}B/{old_count} source files -> {size}B/{count} files)")
            else:
                warnings.append(f"{folder}/: legacy folder remains over budget; no growth detected")
        elif over:
            errors.append(f"{folder}/: folder budget exceeded ({size}B/{count} source files; limits {limits['max_folder_source_bytes']}B/{limits['max_folder_source_files']} files)")

    result = {
        "gate": policy["name"],
        "status": "BLOCKED" if errors else "PASS",
        "base": args.base,
        "changed_source_files_checked": sum(1 for p in changed if source_file(p, policy)),
        "file_budget": {"max_bytes": limits["max_file_bytes"], "default_max_lines": limits["max_file_lines"], "per_extension_max_lines": policy.get("line_limits_by_extension", {})},
        "folder_budget": {"max_recursive_source_bytes": limits["max_folder_source_bytes"], "max_recursive_source_files": limits["max_folder_source_files"]},
        "warnings": warnings,
        "errors": errors,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
