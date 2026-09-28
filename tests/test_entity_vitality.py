from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from mosharrof_vitality import audit_entities


def test_every_registered_entity_is_operationally_alive():
    report = audit_entities(ROOT)
    assert report["status"] == "ALIVE", report["errors"]
    assert report["entity_count"] >= 1
    assert report["blocked_count"] == 0
    assert report["alive_count"] == report["entity_count"]


def test_vitality_audit_is_non_destructive():
    report = audit_entities(ROOT)
    assert all(entity["checks"]["policy"] for entity in report["entities"])
