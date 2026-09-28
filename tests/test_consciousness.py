import json
from pathlib import Path
from scripts.mosharrof_consciousness import CONFIG

def test_consciousness_registry_is_valid():
    data=json.loads(CONFIG.read_text(encoding="utf-8"))
    assert data["principles"]["no_claim_of_sentience"] is True
    assert data["principles"]["read_only_health_audit"] is True
    assert data["components"]

def test_registered_components_exist():
    data=json.loads(CONFIG.read_text(encoding="utf-8"))
    for component in data["components"]:
        assert component["paths"]
        assert all(Path(p).exists() for p in component["paths"])
