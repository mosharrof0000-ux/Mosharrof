from pathlib import Path

from scripts.prepare_web_organ_runtime import copy_organ_components


def test_browser_organ_packaging_copies_private_component_modules(tmp_path):
    source = tmp_path / "organs" / "message-audio"
    destination = tmp_path / "web" / "organs" / "message-audio"
    components = source / "components"
    components.mkdir(parents=True)
    (components / "read-aloud.js").write_text("export const read = true;\n", encoding="utf-8")
    (components / "audio-download.js").write_text("export const download = true;\n", encoding="utf-8")

    copy_organ_components(source, destination)

    assert (destination / "components" / "read-aloud.js").read_text(encoding="utf-8") == "export const read = true;\n"
    assert (destination / "components" / "audio-download.js").is_file()
