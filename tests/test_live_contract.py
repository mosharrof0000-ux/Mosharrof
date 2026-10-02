"""Live foundation contract tests for Mosharrof Pages and machine-readable architecture."""
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_live_pages_contract():
    web = ROOT / "web"
    assert (web / "index.html").is_file()
    assert (web / "styles.css").is_file()
    assert (web / "app.js").is_file()
    assert (web / "manifest.json").is_file()
    assert (web / "sw.js").is_file()
    html = (web / "index.html").read_text(encoding="utf-8")
    assert "Mosharrof" in html


def test_pages_workflow_contract():
    workflow = (ROOT / ".github" / "workflows" / "deploy-pages.yml").read_text(encoding="utf-8")
    assert "actions/upload-pages-artifact" in workflow
    assert "actions/deploy-pages" in workflow
    assert "needs: test" in workflow
    assert "branches: [main]" in workflow


def test_machine_readable_contract_is_consistent():
    manifest = json.loads(
        (ROOT / "config" / "project_manifest.json").read_text(encoding="utf-8")
    )
    registry = json.loads(
        (ROOT / "config" / "entity_registry.json").read_text(encoding="utf-8")
    )
    assert manifest["owner"] == "Mosharrof Karim"
    assert manifest["immutable_safety_rules"]["delete"] is False
    ids = {entity["id"] for entity in registry["entities"]}
    assert {"core", "chat", "sidebar", "voice", "storage", "tool_factory", "quran_research"} <= ids


def test_web_output_escapes_untrusted_text():
    html = (ROOT / "web" / "index.html").read_text(encoding="utf-8")
    assert ".replace(/&/g,'&amp;')" in html
    assert ".replace(/</g,'&lt;')" in html
    assert ".replace(/>/g,'&gt;')" in html
    legacy = (ROOT / "src" / "web_server.py").read_text(encoding="utf-8")
    assert "userNode.innerHTML" not in legacy
    assert "aiNode.innerHTML" not in legacy
