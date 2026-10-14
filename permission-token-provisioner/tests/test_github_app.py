from datetime import datetime, timedelta, timezone
import pytest
from provisioner.github_app import GitHubAppAdapter, ProvisioningDenied
from provisioner.policy import Action, Approval, Request

class ApprovalOK:
    def authorize_and_consume(self, request, approval): return True
class ApprovalNo:
    def authorize_and_consume(self, request, approval): return False
class Vault:
    def __init__(self): self.saved = None
    def store_secret(self, **kwargs):
        self.saved = kwargs
        return "vault://secrets/credential-123"

def setup_request(environment="staging"):
    req = Request(provider="github", action=Action.CREATE_CREDENTIAL,
        permission_set=frozenset({"contents:read"}), resource_scope="repository_ids:123",
        environment=environment, capability="read repository content for a staging health check")
    approval = Approval(approval_id="approval-123", provider="github", action=Action.CREATE_CREDENTIAL,
        permission_set=req.permission_set, resource_scope=req.resource_scope, environment=environment,
        capability=req.capability, expires_at=datetime.now(timezone.utc) + timedelta(minutes=5))
    return req, approval

def make_adapter(approval_service=None, vault=None):
    return GitHubAppAdapter(app_id="app-id", installation_id="install-id",
        private_key="not-used-in-denied-path", approval_service=approval_service or ApprovalOK(),
        vault=vault or Vault())

def test_requires_owner_approval_before_provider_request():
    req, approval = setup_request()
    with pytest.raises(ProvisioningDenied, match="owner_approval"):
        make_adapter(ApprovalNo()).issue_token(request=req, approval=approval,
            permissions={"contents": "read"}, repository_ids=[123])

def test_production_provisioning_is_disabled():
    req, approval = setup_request("production")
    with pytest.raises(ProvisioningDenied, match="production"):
        make_adapter().issue_token(request=req, approval=approval,
            permissions={"contents": "read"}, repository_ids=[123])

def test_permission_scope_must_exactly_match_approval():
    req, approval = setup_request()
    with pytest.raises(ProvisioningDenied, match="do_not_match"):
        make_adapter().issue_token(request=req, approval=approval,
            permissions={"contents": "write"}, repository_ids=[123])

def test_requires_explicit_repository_scope():
    req, approval = setup_request()
    with pytest.raises(ProvisioningDenied, match="repository_ids"):
        make_adapter().issue_token(request=req, approval=approval,
            permissions={"contents": "read"}, repository_ids=[])

def test_repository_ids_must_match_approved_resource_scope():
    req, approval = setup_request()
    with pytest.raises(ProvisioningDenied, match="repository_scope"):
        make_adapter().issue_token(request=req, approval=approval,
            permissions={"contents": "read"}, repository_ids=[456])

def test_success_returns_only_vault_handle_and_stores_raw_token_in_vault():
    req, approval = setup_request()
    vault = Vault()
    instance = make_adapter(vault=vault)
    instance._create_installation_token = lambda permissions, repository_ids: {
        "token": "sensitive-test-token", "expires_at": "2026-10-14T21:00:00Z"
    }
    result = instance.issue_token(request=req, approval=approval,
        permissions={"contents": "read"}, repository_ids=[123])
    assert result.handle == "vault://secrets/credential-123"
    assert "sensitive-test-token" not in repr(result)
    assert vault.saved["value"] == "sensitive-test-token"
    assert vault.saved["metadata"]["repository_ids"] == "123"
    assert vault.saved["metadata"]["permissions"] == '{"contents": "read"}'
