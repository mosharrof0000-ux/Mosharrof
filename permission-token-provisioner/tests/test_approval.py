from datetime import datetime, timedelta, timezone
from provisioner.approval import HmacSQLiteApprovalService, sign_approval
from provisioner.policy import Action, Approval, Request

SECRET = b"test-only-secret-with-at-least-32-bytes"

def setup():
    req = Request(provider="github", action=Action.CREATE_CREDENTIAL,
        permission_set=frozenset({"contents:read"}), resource_scope="repository_ids:123",
        environment="staging", capability="read repository content")
    approval = Approval(approval_id="approval-signed-1", provider=req.provider, action=req.action,
        permission_set=req.permission_set, resource_scope=req.resource_scope, environment=req.environment,
        capability=req.capability, expires_at=datetime.now(timezone.utc) + timedelta(minutes=5))
    return req, approval

def test_valid_signed_approval_is_consumed_once(tmp_path):
    req, approval = setup()
    signed = Approval(**{**approval.__dict__, "signature": sign_approval(approval, SECRET)})
    service = HmacSQLiteApprovalService(secret=SECRET, database_path=str(tmp_path / "approvals.sqlite"))
    assert service.authorize_and_consume(req, signed) is True
    assert service.authorize_and_consume(req, signed) is False

def test_modified_approval_is_rejected(tmp_path):
    req, approval = setup()
    signed = Approval(**{**approval.__dict__, "signature": sign_approval(approval, SECRET),
                         "permission_set": frozenset({"contents:write"})})
    service = HmacSQLiteApprovalService(secret=SECRET, database_path=str(tmp_path / "approvals.sqlite"))
    assert service.authorize_and_consume(req, signed) is False

def test_scope_mismatch_is_rejected_before_consumption(tmp_path):
    req, approval = setup()
    signed = Approval(**{**approval.__dict__, "signature": sign_approval(approval, SECRET),
                         "resource_scope": "repository_ids:999"})
    service = HmacSQLiteApprovalService(secret=SECRET, database_path=str(tmp_path / "approvals.sqlite"))
    assert service.authorize_and_consume(req, signed) is False

def test_expired_approval_is_rejected(tmp_path):
    req, approval = setup()
    expired = Approval(**{**approval.__dict__, "expires_at": datetime.now(timezone.utc)-timedelta(seconds=1)})
    signed = Approval(**{**expired.__dict__, "signature": sign_approval(expired, SECRET)})
    service = HmacSQLiteApprovalService(secret=SECRET, database_path=str(tmp_path / "approvals.sqlite"))
    assert service.authorize_and_consume(req, signed) is False
