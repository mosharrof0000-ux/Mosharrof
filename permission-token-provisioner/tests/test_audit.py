import sqlite3
import pytest
from provisioner.audit import AuditEvent, AuditLog

def event(**overrides):
    values = dict(actor_ref="owner-session:abc", approval_ref="approval:123", provider="github",
        capability="repository.read", resource_scope="repository_ids:123", environment="staging",
        credential_id="installation:123", result="success", correlation_id="corr:456")
    values.update(overrides)
    return AuditEvent(**values)

def test_audit_chain_is_valid_and_append_only(tmp_path):
    path = str(tmp_path / "audit.sqlite")
    log = AuditLog(database_path=path)
    first = log.append(event())
    second = log.append(event(result="denied", correlation_id="corr:789"))
    assert first != second
    assert log.verify_chain()
    with sqlite3.connect(path) as db:
        with pytest.raises(sqlite3.IntegrityError, match="append_only"):
            db.execute("UPDATE audit_events SET result='changed' WHERE sequence=1")

def test_secret_like_values_are_rejected(tmp_path):
    log = AuditLog(database_path=str(tmp_path / "audit.sqlite"))
    with pytest.raises(ValueError, match="secret_like"):
        log.append(event(capability="token: leaked-value"))

def test_chain_detects_database_tampering(tmp_path):
    path = str(tmp_path / "audit.sqlite")
    log = AuditLog(database_path=path)
    log.append(event())
    with sqlite3.connect(path) as db:
        db.execute("DROP TRIGGER audit_events_no_update")
        db.execute("UPDATE audit_events SET result='tampered' WHERE sequence=1")
    assert not log.verify_chain()
