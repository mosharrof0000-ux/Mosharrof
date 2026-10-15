#!/usr/bin/env python3
"""Build a deterministic organ registry from per-organ manifests; no giant hand-maintained list."""
from __future__ import annotations
import argparse, json, re, sys
from pathlib import Path
from typing import Any

ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MAX_LINKS_PER_ORGAN = 20

class RegistryError(ValueError):
    """Invalid organ manifest or dependency graph."""

def build_registry(root: Path) -> dict[str, Any]:
    organs_root = root / "organs"
    manifests: dict[str, dict[str, Any]] = {}
    if not organs_root.is_dir():
        raise RegistryError("organs/: required organ root folder is missing; every organ must have its own folder")
    organ_folders = sorted(path for path in organs_root.iterdir() if path.is_dir() and not path.name.startswith("_"))
    if not organ_folders:
        raise RegistryError("organs/: no organ folders found; every organ must be isolated in its own folder")
    for source in organs_root.iterdir():
        if source.is_file() and source.suffix.lower() in {".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".css", ".html"}:
            raise RegistryError(f"{source.relative_to(root)}: source cannot sit at the organs root; create a dedicated organ folder")
    for organ_folder in organ_folders:
        manifest_path = organ_folder / "organ.json"
        folder_id = organ_folder.name
        nested_manifests = [candidate for candidate in organ_folder.rglob("organ.json") if candidate != manifest_path]
        if nested_manifests:
            nested = nested_manifests[0]
            raise RegistryError(f"{nested.relative_to(root)}: nested organ detected; each organ must have its own top-level folder")
        if not manifest_path.is_file():
            raise RegistryError(f"organs/{folder_id}: missing required organ.json")
        for required in ("index.js", "README.md", "tests/README.md"):
            if not (organ_folder / required).is_file():
                raise RegistryError(f"organs/{folder_id}: missing required {required}")
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise RegistryError(f"{manifest_path.relative_to(root)} is not valid JSON: {exc}") from exc
        organ_id = manifest.get("id")
        if not isinstance(organ_id, str) or not ID_RE.fullmatch(organ_id):
            raise RegistryError(f"{manifest_path.relative_to(root)}: id must be lowercase kebab-case")
        if organ_id != folder_id:
            raise RegistryError(f"{manifest_path.relative_to(root)}: id must match folder '{folder_id}'")
        if organ_id in manifests:
            raise RegistryError(f"duplicate organ id: {organ_id}")
        public_api = manifest.get("public_api")
        if not isinstance(public_api, list) or any(not isinstance(api, str) or not api.strip() for api in public_api):
            raise RegistryError(f"{manifest_path.relative_to(root)}: public_api must be an array of non-empty strings")
        if len(set(public_api)) != len(public_api):
            raise RegistryError(f"{manifest_path.relative_to(root)}: public_api entries must be unique")
        dependencies = manifest.get("dependencies", [])
        if not isinstance(dependencies, list):
            raise RegistryError(f"{manifest_path.relative_to(root)}: dependencies must be an array")
        if len(dependencies) > MAX_LINKS_PER_ORGAN:
            raise RegistryError(f"{manifest_path.relative_to(root)}: {len(dependencies)} dependencies exceed the {MAX_LINKS_PER_ORGAN}-link-per-organ limit")
        normalized_dependencies = []
        seen_dependencies = set()
        for dependency in dependencies:
            if not isinstance(dependency, dict):
                raise RegistryError(f"{manifest_path.relative_to(root)}: each dependency must be an object")
            target_id, api = dependency.get("organ_id"), dependency.get("api")
            if not isinstance(target_id, str) or not ID_RE.fullmatch(target_id):
                raise RegistryError(f"{manifest_path.relative_to(root)}: dependency organ_id is invalid")
            if not isinstance(api, str) or not api.strip():
                raise RegistryError(f"{manifest_path.relative_to(root)}: dependency api must be a non-empty string")
            key = (target_id, api)
            if key in seen_dependencies:
                raise RegistryError(f"{manifest_path.relative_to(root)}: duplicate dependency {target_id}:{api}")
            seen_dependencies.add(key)
            normalized_dependencies.append({"organ_id": target_id, "api": api})
        manifests[organ_id] = {
            "id": organ_id,
            "name": str(manifest.get("name") or organ_id),
            "description": str(manifest.get("description") or ""),
            "public_api": sorted(public_api),
            "dependencies": sorted(normalized_dependencies, key=lambda item: (item["organ_id"], item["api"])),
        }
    for organ_id, manifest in manifests.items():
        for dependency in manifest["dependencies"]:
            target = manifests.get(dependency["organ_id"])
            if target is None:
                raise RegistryError(f"{organ_id}: dependency targets unknown organ '{dependency['organ_id']}'")
            if dependency["api"] not in target["public_api"]:
                raise RegistryError(f"{organ_id}: '{dependency['organ_id']}' does not declare public API '{dependency['api']}'")
    return {
        "schema_version": 1,
        "source": "organs/*/organ.json",
        "max_links_per_organ": MAX_LINKS_PER_ORGAN,
        "organs": [manifests[key] for key in sorted(manifests)],
    }

def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--output", type=Path, default=None, help="Output registry path; omitted when validating only")
    parser.add_argument("--validate-only", action="store_true", help="Validate manifests and dependency graph without writing")
    args = parser.parse_args()
    try:
        registry = build_registry(args.root.resolve())
    except RegistryError as exc:
        print(f"ORGAN REGISTRY: FAIL — {exc}", file=sys.stderr)
        return 1
    if not args.validate_only:
        output = args.output or (args.root / "web" / "runtime" / "organs.registry.json")
        output = output if output.is_absolute() else (args.root / output)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(registry, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
        print(f"ORGAN REGISTRY: PASS — generated {output}")
    else:
        print(f"ORGAN REGISTRY: PASS — validated {len(registry['organs'])} organ(s)")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
