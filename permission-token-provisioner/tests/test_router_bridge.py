from provisioner.policy import Action, Request
from provisioner.router_bridge import ExistingRouterBridge, RouterBridgeError


def request():
    return Request(provider="github", action=Action.READ_ONLY_HEALTH_CHECK,
        permission_set=frozenset({"contents:read"}), resource_scope="repository_ids:123",
        environment="staging", capability="read staging repository")


def test_bridge_uses_existing_router_handle_without_minting():
    calls = []
    bridge = ExistingRouterBridge(
        select_handle=lambda req: "vault://existing/123",
        execute_with_handle=lambda req, handle: calls.append(handle) or {"ok": True},
    )
    handle = bridge.select_credential(request())
    assert handle == "vault://existing/123"
    assert bridge.execute(request(), credential_handle=handle) == {"ok": True}
    assert calls == ["vault://existing/123"]


def test_bridge_returns_none_when_router_has_no_eligible_credential():
    bridge = ExistingRouterBridge(select_handle=lambda req: None,
        execute_with_handle=lambda req, handle: {"ok": True})
    assert bridge.select_credential(request()) is None


def test_bridge_rejects_raw_token_from_router_selection():
    bridge = ExistingRouterBridge(select_handle=lambda req: "ghp_plaintext",
        execute_with_handle=lambda req, handle: {"ok": True})
    try:
        bridge.select_credential(request())
        assert False, "expected fail-closed rejection"
    except RouterBridgeError as exc:
        assert str(exc) == "router_must_return_opaque_vault_handle"


def test_bridge_rejects_secret_fields_in_router_result():
    bridge = ExistingRouterBridge(select_handle=lambda req: "vault://existing/123",
        execute_with_handle=lambda req, handle: {"access_token": "never-return"})
    try:
        bridge.execute(request(), credential_handle="vault://existing/123")
        assert False, "expected fail-closed rejection"
    except RouterBridgeError as exc:
        assert str(exc) == "router_result_contains_secret_fields"


def test_bridge_redacts_router_exception():
    bridge = ExistingRouterBridge(select_handle=lambda req: "vault://existing/123",
        execute_with_handle=lambda req, handle: (_ for _ in ()).throw(
            RuntimeError("secret=DO_NOT_LEAK")))
    try:
        bridge.execute(request(), credential_handle="vault://existing/123")
        assert False, "expected fail-closed rejection"
    except RouterBridgeError as exc:
        assert "DO_NOT_LEAK" not in str(exc)
