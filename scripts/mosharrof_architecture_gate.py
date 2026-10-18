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
SOURCE_SUFFIXES = {".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".css", ".html", ".json"}
LINE_LIMITS = {
    ".js": 250, ".mjs": 250, ".cjs": 250, ".jsx": 250,
    ".ts": 250, ".tsx": 250, ".css": 350, ".html": 300, ".json": 200,
}
MAX_LINKS_PER_FILE = 20
# Cloudflare Worker entrypoint is a separately deployed runtime, not a UI organ.
# Keep the exception narrow and require the chat failover contract tests when edited.
RUNTIME_ENTRYPOINTS = {"worker/screenshot-analysis.js"}
RUNTIME_ENTRYPOINT_MAX_LINES = 1000
# Covers static imports, side-effect imports, re-exports, dynamic imports, and require().
IMPORT_RE = re.compile(
    r"""(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)["']([^"']+)["']"""
)
URL_RE = re.compile(r"""new\s+URL\(\s*["']([^"']+)["']""")
HTML_LINK_RE = re.compile(r"""\b(?:href|src|action|poster)\s*=\s*["']([^"']+)["']""", re.IGNORECASE)
CSS_IMPORT_RE = re.compile(r"""@import\s+(?:url\(\s*)?["']?([^"'\s;)]+)""", re.IGNORECASE)
CSS_URL_RE = re.compile(r"""url\(\s*["']?([^"'\s)]+)""", re.IGNORECASE)


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


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


def count_links(source_text: str, suffix: str) -> list[str]:
    """Return declared file/module/web-resource links for a supported source type."""
    if suffix in {".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx"}:
        return IMPORT_RE.findall(source_text) + URL_RE.findall(source_text)
    if suffix == ".html":
        return HTML_LINK_RE.findall(source_text)
    if suffix == ".css":
        # url() is counted as one reference; avoid double-counting url(...) within @import.
        imports = CSS_IMPORT_RE.findall(source_text)
        without_imports = CSS_IMPORT_RE.sub("", source_text)
        return imports + CSS_URL_RE.findall(without_imports)
    return []


def safe_bootstrap_entrypoint_only(base: str) -> bool:
    """Allow only one additive module-loader line; keep the legacy UI shell otherwise frozen."""
    tag = '<script type="module" src="./entities/bootstrap.js"></script>'
    try:
        diff = git("diff", "--unified=0", f"{base}...HEAD", "--", "web/index.html")
        added = [line[1:] for line in diff.splitlines() if line.startswith("+") and not line.startswith("+++")]
        removed = [line[1:] for line in diff.splitlines() if line.startswith("-") and not line.startswith("---")]
        current = (ROOT / "web" / "index.html").read_text(encoding="utf-8").splitlines()
    except (subprocess.CalledProcessError, OSError):
        return False
    try:
        body_index = current.index("</body>")
    except ValueError:
        return False
    return not removed and added == [tag] and current.count(tag) == 1 and body_index > 0 and current[body_index - 1].strip() == tag


def main() -> int:
    errors: list[str] = []
    try:
        changed = [p for p in git("diff", "--name-only", "--diff-filter=ACMRD", f"{BASE}...HEAD").splitlines() if p]
    except subprocess.CalledProcessError as exc:
        print(f"ARCHITECTURE GATE: FAIL — cannot compare against {BASE}: {exc}", file=sys.stderr)
        return 2

    safe_shell_bootstrap = "web/index.html" in changed and safe_bootstrap_entrypoint_only(BASE)
    if "web/index.html" in changed and not safe_shell_bootstrap:
        errors.append("web/index.html is frozen except for the single verified organ-bootstrap script addition.")

    organs_root = ROOT / "organs"
    organ_folders = sorted(path for path in organs_root.iterdir() if path.is_dir() and not path.name.startswith("_")) if organs_root.is_dir() else []
    if not organs_root.is_dir():
        errors.append("organs/: required organ root folder is missing; every organ must have its own folder.")
    elif not organ_folders:
        errors.append("organs/: no organ folders found; deployment is blocked until every organ is isolated in its own folder.")
    for source in organs_root.iterdir() if organs_root.is_dir() else []:
        if source.is_file() and source.suffix.lower() in SOURCE_SUFFIXES:
            errors.append(f"{source.relative_to(ROOT)}: source cannot sit at the organs root; create a dedicated organs/<organ-id>/ folder.")
    changed_organs = {name for path in changed if (name := organ_name(path))}
    known_ids = set()
    for folder in organ_folders:
        name = folder.name
        manifest = folder / "organ.json"
        for required in ("organ.json", "index.js", "README.md", "tests/README.md"):
            if not (folder / required).is_file():
                errors.append(f"organ '{name}' is incomplete: missing organs/{name}/{required}")
        nested_manifests = [candidate for candidate in folder.rglob("organ.json") if candidate != manifest]
        for nested in nested_manifests:
            errors.append(f"{nested.relative_to(ROOT)}: nested organ detected inside organs/{name}; each organ must have its own top-level folder.")
        if manifest.is_file():
            try:
                data = json.loads(manifest.read_text(encoding="utf-8"))
                organ_id = data.get("id")
                if organ_id != name:
                    errors.append(f"{manifest.relative_to(ROOT)}: manifest id must equal folder name '{name}'")
                if organ_id in known_ids:
                    errors.append(f"{manifest.relative_to(ROOT)}: duplicate organ id '{organ_id}'")
                known_ids.add(organ_id)
                if not isinstance(data.get("public_api"), list):
                    errors.append(f"{manifest.relative_to(ROOT)}: public_api must be an array")
            except (OSError, json.JSONDecodeError) as exc:
                errors.append(f"{manifest.relative_to(ROOT)} is not valid JSON: {exc}")

    # Audit every existing production source in organs/ and core/, not just changed
    # files. Otherwise an oversized file could remain forever if nobody edits it.
    production_paths: set[str] = set()
    for root_name in ("organs", "core"):
        root = ROOT / root_name
        if root.is_dir():
            for candidate in root.rglob("*"):
                if candidate.is_file() and candidate.suffix.lower() in SOURCE_SUFFIXES:
                    rel = candidate.relative_to(ROOT).as_posix()
                    if not is_policy_or_test(rel):
                        production_paths.add(rel)

    # The two web entity files are narrow composition-root exceptions. All feature
    # implementations remain in organs/; these files only connect UI to the runtime.
    composition_roots = {"web/entities/bootstrap.js", "web/entities/organ-bootstrap.js", "web/entities/ui-organ-modules.js", "web/sidebar-recovery.js", "web/sw.js"}
    for path in changed:
        p = Path(path)
        suffix = p.suffix.lower()
        if suffix not in SOURCE_SUFFIXES or is_policy_or_test(path):
            continue
        if path == "web/index.html" and safe_shell_bootstrap:
            continue
        if not (ROOT / p).is_file():
            continue  # Deleted legacy adapters are allowed after organ replacements exist.
        if path in composition_roots:
            source_text = (ROOT / p).read_text(encoding="utf-8")
            if len(source_text.splitlines()) > LINE_LIMITS[suffix]:
                errors.append(f"{path}: composition root exceeds the {LINE_LIMITS[suffix]}-line limit.")
            links = count_links(source_text, suffix)
            if len(links) > MAX_LINKS_PER_FILE:
                errors.append(f"{path}: composition root exceeds the {MAX_LINKS_PER_FILE}-link limit.")
            if path == "web/sw.js" and "mosharrof-v7-2026-10-15-organ-runtime" in source_text:
                errors.append("web/sw.js: cache-affecting changes must bump the organ-runtime cache version.")
            for specifier in links:
                target = resolve_import(ROOT / p, specifier)
                if target and organ_name(target.as_posix()) and not (ROOT / target.parent / "organ.json").is_file():
                    errors.append(f"{path}: composition root imports an organ without a manifest: {target}")
            continue
        if path == "web/runtime/organs.registry.json":
            try:
                artifact = json.loads((ROOT / p).read_text(encoding="utf-8"))
                if not isinstance(artifact.get("organs"), list):
                    errors.append(f"{path}: generated organ registry must contain an organs array.")
            except (OSError, json.JSONDecodeError) as exc:
                errors.append(f"{path}: generated organ registry is invalid JSON: {exc}")
            continue
        if path in RUNTIME_ENTRYPOINTS:
            source_text = (ROOT / p).read_text(encoding="utf-8")
            if len(source_text.splitlines()) > RUNTIME_ENTRYPOINT_MAX_LINES:
                errors.append(f"{path}: runtime entrypoint exceeds the {RUNTIME_ENTRYPOINT_MAX_LINES}-line emergency ceiling.")
            if not (ROOT / "tests" / "test_chat_provider_failover.py").is_file():
                errors.append(f"{path}: runtime changes require tests/test_chat_provider_failover.py.")
            continue
        if not p.parts or p.parts[0] not in {"organs", "core"}:
            errors.append(f"{path}: production source must belong to a dedicated organs/<organ>/ or core/ module.")
            continue
        production_paths.add(path)

    for path in sorted(production_paths):
        p = Path(path)
        suffix = p.suffix.lower()
        full = ROOT / p
        if not full.is_file():
            continue  # Deleted files are not present in the current checkout.
        source_text = full.read_text(encoding="utf-8")
        lines = len(source_text.splitlines())
        limit = LINE_LIMITS[suffix]
        if lines > limit:
            errors.append(f"{path}: {lines} lines exceeds the {limit}-line limit; split by responsibility.")

        links = count_links(source_text, suffix)
        if len(links) > MAX_LINKS_PER_FILE:
            errors.append(
                f"{path}: {len(links)} links exceeds the {MAX_LINKS_PER_FILE}-link-per-file limit; "
                "move related links into a dedicated helper/link module and connect through its public API."
            )

        current_organ = organ_name(path)
        if suffix in {".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx"}:
            for specifier in links:
                target = resolve_import(full, specifier)
                if target is None:
                    continue
                target_organ = organ_name(str(target))
                if target_organ and target_organ != current_organ:
                    errors.append(
                        f"{path}: direct cross-organ import to {target}; use a declared public API/message contract."
                    )

        if "components" in p.parts and suffix in {".js", ".jsx", ".ts", ".tsx"}:
            if not current_organ:
                errors.append(f"{path}: UI component is not owned by an organ.")
            else:
                test_path = ROOT / "organs" / current_organ / "tests" / f"{p.stem}.test.js"
                if not test_path.is_file():
                    errors.append(f"{path}: dedicated component test is required at {test_path.relative_to(ROOT)}.")

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
        "max_links_per_file": MAX_LINKS_PER_FILE,
        "policy": "isolated organs; frozen legacy shell; enforced file-size, link-count, and component-test limits",
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
