import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_capability_registry_structure_and_permanently_blocked_rules():
    path = ROOT / "config" / "capability_registry.json"
    assert path.exists(), "capability_registry.json must exist"
    data = json.loads(path.read_text(encoding="utf-8"))

    assert data.get("schema_version") == "1.0.0"
    assert data.get("registry_id") == "mosharrof.universal_capabilities"

    defaults = data.get("defaults", {})
    assert defaults.get("grant_on_registration") is False
    assert defaults.get("unknown_capability") == "DENY"
    assert defaults.get("permanent_delete_block") is True

    categories = data.get("categories", {})
    assert len(categories) > 0, "categories must not be empty"
    for cat_name, caps in categories.items():
        assert isinstance(caps, list), f"category {cat_name} must be a list"
        assert len(caps) > 0, f"category {cat_name} must contain capabilities"

    rules = data.get("rules", {})
    blocked = rules.get("permanently_blocked", [])
    assert any("delete" in item for item in blocked), "delete operations must be permanently blocked"
