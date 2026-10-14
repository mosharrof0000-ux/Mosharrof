from datetime import datetime, timedelta, timezone
import pytest
from provisioner.cloudflare import CloudflareTokenAdapter, ProvisioningDenied
from provisioner.policy import Action, Approval, Request

GROUP = "a" * 32
RESOURCE = "com.cloudflare.api.account.zone." + "b" * 32

class ApprovalOK:
    def authorize_and_consume(self, request, approval): return True
class ApprovalNo:
    def authorize_and_consume(self, request, approval): return False
class Vault:
    def __init__(self): self.saved = None
    def store_secret(self, **kwargs):
        self.saved = kwargs
        return "vault://secrets/cf-token-1"

def setup(environment="staging", ttl=60, group=GROUP, resource=RESOURCE):
    permissions = frozenset({"cf_permission_group:" + group})
    scope = f"{resource}=*;ttl_minutes={ttl}"
    req = Request(provider="cloudflare", action=Action.CREATE_CREDENTIAL, permission_set=permissions,
        resource_scope=scope, environment=environment, capability="create scoped staging Cloudflare token")
    approval = Approval(approval_id="approval-cf-1", provider="cloudflare", action=Action.CREATE_CREDENTIAL,
        permission_set=permissions, resource_scope=scope, environment=environment,
        capability=req.capability, expires_at=datetime.now(timezone.utc) + timedelta(minutes=5))
    return req, approval

def adapter(service=None, vault=None, clock=None):
    kwargs = dict(bootstrap_token="bootstrap-secret-test-only", approval_service=service or ApprovalOK(),
                  vault=vault or Vault())
    if clock: kwargs["clock"] = clock
    return CloudflareTokenAdapter(**kwargs)

def test_requires_owner_approval():
    req, approval = setup()
    with pytest.raises(ProvisioningDenied, match="owner_approval"):
        adapter(service=ApprovalNo()).issue_token(request=req, approval=approval, token_name="staging-read",
            permission_group_ids=[GROUP], resource_key=RESOURCE, ttl_minutes=60)

def test_production_is_disabled():
    req, approval = setup(environment="production")
    with pytest.raises(ProvisioningDenied, match="production"):
        adapter().issue_token(request=req, approval=approval, token_name="prod",
            permission_group_ids=[GROUP], resource_key=RESOURCE, ttl_minutes=60)

def test_ttl_must_match_exact_approved_scope():
    req, approval = setup(ttl=60)
    with pytest.raises(ProvisioningDenied, match="scope_or_ttl"):
        adapter().issue_token(request=req, approval=approval, token_name="staging",
            permission_group_ids=[GROUP], resource_key=RESOURCE, ttl_minutes=61)

def test_creation_sends_exact_scope_and_returns_only_vault_handle():
    req, approval = setup()
    vault = Vault()
    instance = adapter(vault=vault, clock=lambda: datetime(2026, 10, 14, 12, 0, tzinfo=timezone.utc))
    def fake_post(payload):
        assert payload["policies"] == [{"effect":"allow","permission_groups":[{"id":GROUP}],"resources":{RESOURCE:"*"}}]
        assert payload["expires_on"] == "2026-10-14T13:00:00Z"
        return {"id":"token-id-1","value":"secret-token-test-only","expires_on":payload["expires_on"],
                "policies":payload["policies"]}
    instance._post_create = fake_post
    result = instance.issue_token(request=req, approval=approval, token_name="staging-read",
        permission_group_ids=[GROUP], resource_key=RESOURCE, ttl_minutes=60)
    assert result["handle"] == "vault://secrets/cf-token-1"
    assert "secret-token-test-only" not in repr(result)
    assert vault.saved["value"] == "secret-token-test-only"

def test_wildcard_resource_scope_is_rejected():
    req, approval = setup(resource="com.cloudflare.api.account")
    with pytest.raises(ProvisioningDenied, match="resource_key"):
        adapter().issue_token(request=req, approval=approval, token_name="wide",
            permission_group_ids=[GROUP], resource_key="com.cloudflare.api.account.*", ttl_minutes=60)
