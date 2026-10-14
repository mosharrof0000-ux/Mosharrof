import pytest
from provisioner.engine import ProvisioningEngine
from provisioner.policy import Action, Approval, Request

class GitHubFake:
    def issue_token(self, **kwargs):
        return type("Credential", (), {"provider":"github","handle":"vault://opaque/1",
            "expires_at":"2026-10-14T21:00:00Z","permissions":{"contents":"read"},
            "resource_scope":"repository_ids:123"})()
class CloudflareFake:
    def issue_token(self, **kwargs):
        return {"provider":"cloudflare","handle":"vault://opaque/2","token_id":"id",
                "expires_at":"2026-10-14T21:00:00Z","resource_scope":"scope"}

def req(provider="github", environment="staging", action=Action.CREATE_CREDENTIAL):
    return Request(provider=provider, action=action, permission_set=frozenset({"contents:read"}),
        resource_scope="repository_ids:123", environment=environment, capability="staging read")
def approval_for(request):
    from datetime import datetime, timedelta, timezone
    return Approval(approval_id="a1",provider=request.provider,action=request.action,
        permission_set=request.permission_set,resource_scope=request.resource_scope,
        environment=request.environment,capability=request.capability,
        expires_at=datetime.now(timezone.utc)+timedelta(minutes=2))

def test_dispatches_github_without_returning_raw_token():
    request=req()
    result=ProvisioningEngine(github=GitHubFake()).provision(request=request,approval=approval_for(request),
        options={"permissions":{"contents":"read"},"repository_ids":[123]})
    assert result["handle"]=="vault://opaque/1"
    assert "token" not in result

def test_unsupported_provider_fails_closed():
    request=req("future-provider")
    with pytest.raises(ValueError,match="unsupported_provider"):
        ProvisioningEngine().provision(request=request,approval=approval_for(request),options={})

def test_production_never_dispatches():
    request=req(environment="production")
    with pytest.raises(ValueError,match="provider_or_environment"):
        ProvisioningEngine(github=GitHubFake()).provision(request=request,approval=approval_for(request),
            options={"permissions":{"contents":"read"},"repository_ids":[123]})

def test_unknown_provider_options_are_rejected():
    request=req()
    with pytest.raises(ValueError,match="github_options"):
        ProvisioningEngine(github=GitHubFake()).provision(request=request,approval=approval_for(request),
            options={"permissions":{"contents":"read"},"repository_ids":[123],"extra":"widen-scope"})
