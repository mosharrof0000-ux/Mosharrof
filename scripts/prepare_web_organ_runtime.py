#!/usr/bin/env python3
"""Prepare browser-loadable organ runtime assets inside the GitHub Pages artifact."""
from __future__ import annotations
import json, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.mosharrof_registry import build_registry  # noqa: E402


def main() -> int:
    expected = build_registry(ROOT)
    registry_path = ROOT / "web/runtime/organs.registry.json"
    try:
        actual = json.loads(registry_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"ORGAN ASSET PREP: invalid registry artifact: {exc}")
    if actual != expected:
        raise SystemExit("ORGAN ASSET PREP: registry artifact differs from organ manifests")
    copies = {
        "core/organ-registry/index.js": "web/runtime/core/organ-registry/index.js",
        "core/link-manager/index.js": "web/runtime/core/link-manager/index.js",
        "core/organ-runtime/index.js": "web/runtime/core/organ-runtime/index.js",
        "core/organ-runtime/persistent-memory.js": "web/runtime/core/organ-runtime/persistent-memory.js",
        "core/organ-runtime/scoped-api.js": "web/runtime/core/organ-runtime/scoped-api.js",
    }
    for source, destination in copies.items():
        src, dst = ROOT / source, ROOT / destination
        if not src.is_file():
            raise SystemExit(f"ORGAN ASSET PREP: missing {source}")
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
    bootstrap = (ROOT / "web/entities/organ-modules.js").read_text(encoding="utf-8")
    ui_ids = []
    for folder in sorted((ROOT / "organs").iterdir()):
        manifest_path = folder / "organ.json"
        if not folder.is_dir() or not manifest_path.is_file():
            continue
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if not {"getHealth", "reportIssue"}.issubset(set(manifest.get("public_api", []))):
            continue
        organ_id, source = manifest["id"], folder / "index.js"
        if not source.is_file() or f'"../organs/{organ_id}/index.js"' not in bootstrap:
            raise SystemExit(f"ORGAN ASSET PREP: UI organ {organ_id} is not wired in bootstrap")
        content = source.read_text(encoding="utf-8").replace("../../web/entities/", "../../entities/")
        if "../../web/entities/" in content:
            raise SystemExit(f"ORGAN ASSET PREP: invalid import in {source}")
        dst = ROOT / "web/organs" / organ_id / "index.js"
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(content, encoding="utf-8")
        ui_ids.append(organ_id)
    required = [ROOT / p for p in (
        "web/runtime/core/organ-registry/index.js", "web/runtime/core/link-manager/index.js",
        "web/runtime/core/organ-runtime/index.js", "web/runtime/core/organ-runtime/persistent-memory.js",
        "web/runtime/core/organ-runtime/scoped-api.js", "web/organs/chat/index.js", "web/organs/notes/index.js", "web/organs/voice/index.js")]
    if not all(p.is_file() for p in required):
        raise SystemExit("ORGAN ASSET PREP: required browser files are missing")
    print(f"ORGAN ASSET PREP: PASS — {len(ui_ids)} UI organs prepared")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
