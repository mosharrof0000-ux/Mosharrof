from datetime import datetime, timedelta, timezone

from provisioner.orchestrator import PermissionActionOrchestrator, TaskIntent
from provisioner.policy import Action, Approval, Request


def make_request(action=Action.READ_ONLY_HEALTH_CHECK, environment="staging"):
    return Request(provider="github", action=action,
        permission_set=frozenset({"contents:read"}), resource_scope="repository_ids:123",
        environment=environment, capability="read staging repository")


def make_approval(request):
    return Approval(approval_id="approval-1", provider=request.provider,
        action=request.action, permission_set=request.permission_set,
        resource_scope=request.resource_scope, environment=request.environment,
        capability=request.capability,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=2))


class Router:
    def __init__(self, handle="vault://credential/1"):
        self.handle = handle
        self.executed = 0
    def select_credential(self, request):
        return self.handle
    def execute(self, request, *, credential_handle):
        self.executed += 1
        return {"ok": True, "handle_used": credential_handle}


class Provisioner:
    def __init__(self, result=None):
        self.calls = 0
        self.result = result or {"handle": "vault://credential/new", "expires_at": "soon"}
    def provision(self, **kwargs):
        self.calls += 1
        return self.result


class ApprovalVerifier:
    def __init__(self, valid=True):
        self.valid = valid
        self.calls = 0
    def verify_and_consume(self, **kwargs):
        self.calls += 1
        return self.valid


def build(router=None, provisioner=None, verifier=None):
    return PermissionActionOrchestrator(router=router or Router(),
        provisioner=provisioner or Provisioner(),
        approval_verifier=verifier or ApprovalVerifier())


def test_existing_credential_is_reused_for_read_only_task():
    router = Router()
    provisioner = Provisioner()
    result = build(router=router, provisioner=provisioner).run(
        intent=TaskIntent(make_request(), "op-1", {}))
    assert result.status == "COMPLETED"
    assert result.credential_handle == "vault://credential/1"
    assert router.executed == 1
    assert provisioner.calls == 0


def test_missing_credential_requests_approval_without_minting():
    router = Router(handle=None)
    provisioner = Provisioner()
    result = build(router=router, provisioner=provisioner).run(
        intent=TaskIntent(make_request(), "op-2", {}))
    assert result.status == "APPROVAL_REQUIRED"
    assert result.reason == "no_eligible_existing_credential"
    assert provisioner.calls == 0


def test_privileged_action_never_mints_without_approval():
    provisioner = Provisioner()
    result = build(provisioner=provisioner).run(
        intent=TaskIntent(make_request(Action.CREATE_CREDENTIAL), "op-3", {}))
    assert result.status == "APPROVAL_REQUIRED"
    assert provisioner.calls == 0


def test_invalid_or_replayed_approval_does_not_mint():
    provisioner = Provisioner()
    request = make_request(Action.CREATE_CREDENTIAL)
    result = build(provisioner=provisioner, verifier=ApprovalVerifier(False)).run(
        intent=TaskIntent(request, "op-4", {}), approval=make_approval(request))
    assert result.status == "DENIED"
    assert result.reason == "approval_invalid_or_replayed"
    assert provisioner.calls == 0


def test_approved_privileged_action_returns_only_opaque_handle_and_redacted_result():
    request = make_request(Action.CREATE_CREDENTIAL)
    provisioner = Provisioner({"handle": "vault://credential/new",
        "access_token": "must-not-leak", "metadata": {"api_secret": "nested-secret", "region": "test"}})
    result = build(provisioner=provisioner).run(
        intent=TaskIntent(request, "op-5", {}), approval=make_approval(request))
    assert result.status == "READY"
    assert result.credential_handle == "vault://credential/new"
    assert "access_token" not in result.result
    assert "api_secret" not in result.result["metadata"]
    assert result.result["metadata"]["region"] == "test"
    assert "must-not-leak" not in repr(result)
    assert provisioner.calls == 1


def test_production_is_blocked_even_with_approval():
    request = make_request(Action.READ_ONLY_HEALTH_CHECK, environment="production")
    router = Router()
    result = build(router=router).run(
        intent=TaskIntent(request, "op-6", {}), approval=make_approval(request))
    assert result.status == "DENIED"
    assert result.reason == "production_integration_not_enabled"
    assert router.executed == 0


def test_provider_failure_is_redacted():
    class BrokenRouter(Router):
        def execute(self, request, *, credential_handle):
            raise RuntimeError("provider secret=DO_NOT_LEAK")
    result = build(router=BrokenRouter()).run(
        intent=TaskIntent(make_request(), "op-7", {}))
    assert result.status == "FAILED"
    assert "DO_NOT_LEAK" not in repr(result)


def test_non_opaque_handle_is_rejected():
    request = make_request(Action.CREATE_CREDENTIAL)
    provisioner = Provisioner({"handle": "plain-token-value", "token": "plain-token-value"})
    result = build(provisioner=provisioner).run(
        intent=TaskIntent(request, "op-8", {}), approval=make_approval(request))
    assert result.status == "FAILED"
    assert result.reason == "provisioner_did_not_return_opaque_vault_handle"
