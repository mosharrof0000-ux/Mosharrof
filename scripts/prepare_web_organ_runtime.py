#!/usr/bin/env python3
"""Prepare browser-loadable organ runtime assets inside the GitHub Pages artifact."""
from __future__ import annotations
import json, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.mosharrof_registry import build_registry  # noqa: E402
from scripts.manual_provider_runtime_patch import apply_manual_provider_patches  # noqa: E402


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
        "core/organ-runtime/persistent-memory.js": "web/runtime/core/organ-runtime/persistent-memory.js",
        "core/organ-runtime/scoped-api.js": "web/runtime/core/organ-runtime/scoped-api.js",
        "core/ui-module-adapter/index.js": "web/runtime/core/ui-module-adapter/index.js",
        "organs/history/history-ui.js": "web/organs/history/history-ui.js",
        "core/composer-enhancements.js": "web/composer-enhancements.js",
        "core/composer-layout.js": "web/composer-layout.js",
        "core/composer-voice-meter.js": "web/composer-voice-meter.js",
        "core/composer-autogrow.js": "web/composer-autogrow.js",
        "core/composer-line-limit.js": "web/composer-line-limit.js",
        "core/./composer-line-limit.js": "web/core/composer-line-limit.js",
        "core/device-control.js": "web/device-control.js",
        "core/video-generation-ui.js": "web/video-generation-ui.js",
        "core/drawer-state-guard.js": "web/core/drawer-state-guard.js",
        "core/personal-memory-engine.js": "web/core/personal-memory-engine.js",
        "core/personal-memory-bridge.js": "web/core/personal-memory-bridge.js",
        "core/design-intelligence.js": "web/core/design-intelligence.js",
        "core/manual-provider-controls.js": "web/core/manual-provider-controls.js",
        "core/design-intelligence.css": "web/design-intelligence.css",
        "core/new-chat-floating/index.js": "web/core/new-chat-floating/index.js",
        "core/new-chat-floating/style.css": "web/core/new-chat-floating/style.css",
    }
    for source, destination in copies.items():
        src, dst = ROOT / source, ROOT / destination
        if not src.is_file():
            raise SystemExit(f"ORGAN ASSET PREP: missing {source}")
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
    # Bundle the same memory modules at the runtime path used by the injected module script.
    for name in ("personal-memory-engine.js", "personal-memory-bridge.js"):
        src = ROOT / "core" / name
        dst = ROOT / "web/runtime/core" / name
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
    # The composer enhancement is loaded from both the Pages root and core/.
    stop_source = ROOT / "core/composer-stop.js"
    for destination in ("web/composer-stop.js", "web/core/composer-stop.js"):
        target = ROOT / destination
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(stop_source, target)
    meter_source = ROOT / "core/composer-voice-meter.js"
    for destination in ("web/composer-voice-meter.js", "web/core/composer-voice-meter.js"):
        target = ROOT / destination
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(meter_source, target)
    # Inject runtime-only enhancements into the prepared Pages artifact; keep the tracked legacy entrypoint frozen.
    index_path = ROOT / "web/index.html"
    index_html = index_path.read_text(encoding="utf-8")
    device_tag = '<script src="./device-control.js"></script>'
    if device_tag not in index_html:
        anchor_tag = '<script src="./sidebar-recovery.js"></script>'
        if anchor_tag not in index_html:
            raise SystemExit("ORGAN ASSET PREP: sidebar script anchor missing for device-control asset")
        index_html = index_html.replace(anchor_tag, anchor_tag + "\n" + device_tag, 1)

    video_tag = '<script src="./video-generation-ui.js"></script>'
    if video_tag not in index_html:
        if device_tag not in index_html:
            raise SystemExit("ORGAN ASSET PREP: device-control script anchor missing for video UI")
        index_html = index_html.replace(device_tag, device_tag + "\n" + video_tag, 1)

    design_css_tag = '<link rel="stylesheet" href="./design-intelligence.css">'
    if design_css_tag not in index_html:
        if "</head>" not in index_html:
            raise SystemExit("ORGAN ASSET PREP: HTML head anchor missing for design intelligence stylesheet")
        index_html = index_html.replace("</head>", "  " + design_css_tag + "\n</head>", 1)

    design_script_tag = '<script src="./core/design-intelligence.js"></script>'
    if design_script_tag not in index_html:
        anchor_tag = '<script src="./sidebar-recovery.js"></script>'
        if anchor_tag not in index_html:
            raise SystemExit("ORGAN ASSET PREP: sidebar script anchor missing for design intelligence engine")
        index_html = index_html.replace(anchor_tag, anchor_tag + "\n" + design_script_tag, 1)

    manual_controls_tag = '<script src="./core/manual-provider-controls.js"></script>'
    if manual_controls_tag not in index_html:
        anchor_tag = '<script src="./core/design-intelligence.js"></script>'
        if anchor_tag not in index_html:
            raise SystemExit("ORGAN ASSET PREP: design intelligence script anchor missing for manual provider controls")
        index_html = index_html.replace(anchor_tag, anchor_tag + "\n" + manual_controls_tag, 1)

    memory_bridge_tag = '<script type="module">import "./runtime/core/personal-memory-bridge.js";</script>'
    if memory_bridge_tag not in index_html:
        if video_tag not in index_html:
            raise SystemExit("ORGAN ASSET PREP: video script anchor missing for memory bridge")
        index_html = index_html.replace(video_tag, video_tag + "\n" + memory_bridge_tag, 1)

    index_html = apply_manual_provider_patches(index_html)

    index_path.write_text(index_html, encoding="utf-8")
    # Preserve the organ-relative import path and the live-page fallback path.
    layout_source = ROOT / "core/composer-layout.js"
    for destination in ("web/composer-layout.js", "web/core/composer-layout.js"):
        target = ROOT / destination
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(layout_source, target)

    composer_source = ROOT / "core/composer-enhancements.js"
    composer_runtime = ROOT / "web/core/composer-enhancements.js"
    composer_runtime.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(composer_source, composer_runtime)
    autogrow_source = ROOT / "core/composer-autogrow.js"
    autogrow_runtime = ROOT / "web/core/composer-autogrow.js"
    autogrow_runtime.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(autogrow_source, autogrow_runtime)
    bootstrap = (ROOT / "web/entities/organ-bootstrap.js").read_text(encoding="utf-8")
    extra_bootstrap = (ROOT / "web/entities/ui-organ-modules.js").read_text(encoding="utf-8")
    import_contract = bootstrap + "\n" + extra_bootstrap
    ui_ids = []
    for folder in sorted((ROOT / "organs").iterdir()):
        manifest_path = folder / "organ.json"
        if not folder.is_dir() or not manifest_path.is_file():
            continue
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if not {"getHealth", "reportIssue"}.issubset(set(manifest.get("public_api", []))):
            continue
        organ_id, source = manifest["id"], folder / "index.js"
        if not source.is_file() or f'"../organs/{organ_id}/index.js"' not in import_contract:
            raise SystemExit(f"ORGAN ASSET PREP: UI organ {organ_id} is not wired in bootstrap")
        content = source.read_text(encoding="utf-8").replace("../../web/entities/", "../../entities/").replace("../../core/ui-module-adapter/", "../../runtime/core/ui-module-adapter/")
        if "../../web/entities/" in content:
            raise SystemExit(f"ORGAN ASSET PREP: invalid import in {source}")
        dst = ROOT / "web/organs" / organ_id / "index.js"
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(content, encoding="utf-8")
        ui_ids.append(organ_id)
    required = [ROOT / p for p in (
        "web/runtime/core/organ-registry/index.js", "web/runtime/core/link-manager/index.js",
        "web/runtime/core/organ-runtime/index.js", "web/runtime/core/organ-runtime/persistent-memory.js", "web/runtime/core/organ-runtime/scoped-api.js", "web/organs/chat/index.js", "web/organs/notes/index.js", "web/device-control.js", "web/video-generation-ui.js", "web/core/personal-memory-engine.js", "web/core/personal-memory-bridge.js", "web/runtime/core/personal-memory-engine.js", "web/runtime/core/personal-memory-bridge.js", "web/core/design-intelligence.js", "web/design-intelligence.css", "web/core/new-chat-floating/index.js", "web/core/new-chat-floating/style.css")]
    if not all(p.is_file() for p in required):
        raise SystemExit("ORGAN ASSET PREP: required browser files are missing")
    print(f"ORGAN ASSET PREP: PASS — {len(ui_ids)} UI organs prepared")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
