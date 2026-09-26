"""Canonical Mosharrof project manifest."""
PROJECT_MANIFEST = {
    "schema_version": "1.0.0",
    "project_id": "mosharrof-core",
    "name": "Mosharrof",
    "owner": "Mosharrof Karim",
    "architecture": "modular-entity-brain",
    "capability_formula": "AI_BRAIN x PERMISSION x POLICY x SCOPE x IDENTITY",
    "permanent_rules": {"delete_operations": "DENIED", "destructive_operations": "DENIED",
                        "entity_isolation": True, "audit_required": True},
    "model_policy": {"provider_agnostic": True, "model_migration_preserves_identity": True},
}
