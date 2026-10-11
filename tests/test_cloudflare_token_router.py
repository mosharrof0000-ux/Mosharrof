import json

import pytest

from src.core.cloudflare_token_router import CloudflareTokenRouter, TokenResolutionError


def registry(tmp_path, profiles):
    path = tmp_path / "tokens.json"
    path.write_text(json.dumps({"provider": "cloudflare", "profiles": profiles}), encoding="utf-8")
    return path


def profile(token_id, secret_env, permissions, scopes, enabled=True):
    return {
        "token_id": token_id,
        "secret_env": secret_env,
        "permissions": permissions,
        "resource_scopes": scopes,
        "enabled": enabled,
    }


def test_selects_least_privilege_credential_and_never_exposes_secret_in_status(tmp_path):
    secret = "cf-secret-value-do-not-log"
    path = registry(tmp_path, [
        profile("broad", "CLOUDFLARE_TOKEN_BROAD", ["Workers Scripts:Edit", "Account:Read", "Zone:Read"], ["account/abc"]),
        profile("narrow", "CLOUDFLARE_TOKEN_NARROW", ["Workers Scripts:Edit"], ["account/abc"]),
    ])
    router = CloudflareTokenRouter(path, {
        "CLOUDFLARE_TOKEN_BROAD": "broad-secret",
        "CLOUDFLARE_TOKEN_NARROW": secret,
    })

    credential = router.resolve({"Workers Scripts:Edit"}, "account/abc/worker/demo")
    assert credential.token_id == "narrow"
    assert credential.token == secret
    assert secret not in json.dumps(router.status())
    assert secret not in json.dumps(credential.audit_record({"Workers Scripts:Edit"}, "account/abc/worker/demo"))


def test_denies_missing_secret_or_scope_mismatch(tmp_path):
    path = registry(tmp_path, [
        profile("worker-edit", "CLOUDFLARE_TOKEN_WORKER_EDIT", ["Workers Scripts:Edit"], ["account/abc"]),
    ])
    router = CloudflareTokenRouter(path, {})
    with pytest.raises(TokenResolutionError):
        router.resolve({"Workers Scripts:Edit"}, "account/abc/worker/demo")

    router = CloudflareTokenRouter(path, {"CLOUDFLARE_TOKEN_WORKER_EDIT": "secret"})
    with pytest.raises(TokenResolutionError):
        router.resolve({"Workers Scripts:Edit"}, "account/other/worker/demo")


def test_disabled_profiles_are_never_selected(tmp_path):
    path = registry(tmp_path, [
        profile("disabled", "CLOUDFLARE_TOKEN_DISABLED", ["Workers Scripts:Edit"], ["account/abc"], enabled=False),
    ])
    router = CloudflareTokenRouter(path, {"CLOUDFLARE_TOKEN_DISABLED": "secret"})
    with pytest.raises(TokenResolutionError):
        router.resolve({"Workers Scripts:Edit"}, "account/abc/worker/demo")


def test_invalid_registry_env_name_fails_closed(tmp_path):
    path = registry(tmp_path, [profile("bad", "token-value", ["Workers Scripts:Edit"], ["account/abc"])])
    with pytest.raises(ValueError, match="INVALID_SECRET_ENV_NAME"):
        CloudflareTokenRouter(path, {})
