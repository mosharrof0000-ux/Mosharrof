from datetime import datetime, timedelta, timezone

from provisioner.policy import Action, Approval, Decision, Request, evaluate


NOW = datetime(2026, 10, 14, 12, 0, tzinfo=timezone.utc)


def request(action=Action.CREATE_CREDENTIAL, environment="staging"):
    return Request(
        provider="cloudflare",
        action=action,
        permission_set=frozenset({"Workers Scripts Edit"}),
        resource_scope="account:example/workers:staging",
        environment=environment,
        capability="worker.deploy",
    )


def approval_for(req, expires_at=None):
    return Approval(
        approval_id="approval-123",
        provider=req.provider,
        action=req.action,
        permission_set=req.permission_set,
        resource_scope=req.resource_scope,
        environment=req.environment,
        capability=req.capability,
        expires_at=expires_at or NOW + timedelta(minutes=5),
    )


def test_privileged_action_requires_approval():
    result = evaluate(request(), now=NOW)
    assert result.decision == Decision.APPROVAL_REQUIRED


def test_exact_authenticated_approval_allows_action():
    req = request()
    result = evaluate(req, approval=approval_for(req), approval_authentic=True, now=NOW)
    assert result.decision == Decision.ALLOW


def test_unauthenticated_approval_is_denied():
    req = request()
    result = evaluate(req, approval=approval_for(req), approval_authentic=False, now=NOW)
    assert result.decision == Decision.DENY
    assert result.reason == "approval_not_authenticated"


def test_scope_mismatch_is_denied():
    req = request()
    approval = approval_for(req)
    wrong_scope = Approval(
        approval_id=approval.approval_id,
        provider=approval.provider,
        action=approval.action,
        permission_set=approval.permission_set,
        resource_scope="account:other/workers:production",
        environment=approval.environment,
        capability=approval.capability,
        expires_at=approval.expires_at,
    )
    result = evaluate(req, approval=wrong_scope, approval_authentic=True, now=NOW)
    assert result.decision == Decision.DENY
    assert result.reason == "approval_scope_mismatch"


def test_expired_approval_is_denied():
    req = request()
    result = evaluate(
        req,
        approval=approval_for(req, NOW - timedelta(seconds=1)),
        approval_authentic=True,
        now=NOW,
    )
    assert result.decision == Decision.DENY
    assert result.reason == "approval_expired"


def test_replayed_approval_is_denied():
    req = request()
    result = evaluate(
        req,
        approval=approval_for(req),
        approval_authentic=True,
        approval_already_used=True,
        now=NOW,
    )
    assert result.decision == Decision.DENY
    assert result.reason == "approval_replay_detected"


def test_production_read_only_is_not_enabled_by_scaffold():
    result = evaluate(request(Action.READ_ONLY_HEALTH_CHECK, "production"), now=NOW)
    assert result.decision == Decision.DENY


def test_staging_read_only_health_check_is_allowed():
    result = evaluate(request(Action.READ_ONLY_HEALTH_CHECK), now=NOW)
    assert result.decision == Decision.ALLOW
