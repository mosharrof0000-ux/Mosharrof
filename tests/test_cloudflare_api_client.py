import json
from urllib.error import HTTPError
from unittest.mock import patch

import pytest

from src.core.cloudflare_api_client import CloudflareAPIClient, CloudflareAPIError
from src.core.cloudflare_token_router import CloudflareTokenRouter


def make_client(tmp_path, env=None, audit=None):
    registry = tmp_path / "registry.json"
    registry.write_text(json.dumps({
        "provider": "cloudflare",
        "profiles": [{
            "token_id": "zone-read",
            "secret_env": "CF_ZONE_READ_TOKEN",
            "permissions": ["Zone Read", "DNS Read"],
            "resource_scopes": ["/zones/zone-123"],
            "enabled": True,
        }]
    }), encoding="utf-8")
    return CloudflareAPIClient(
        CloudflareTokenRouter(registry, environ=env or {"CF_ZONE_READ_TOKEN": "test-secret"}),
        audit=audit,
    )


def test_rejects_arbitrary_hosts_and_traversal(tmp_path):
    client = make_client(tmp_path)
    for path in ("https://evil.example/steal", "/zones/../user/tokens", "/zones/zone-123?x=1", "//evil"):
        with pytest.raises(CloudflareAPIError):
            client.request("GET", path, required_permissions={"Zone Read"}, resource_scope="/zones/zone-123")


def test_denies_missing_permission_before_network(tmp_path):
    client = make_client(tmp_path)
    with patch("src.core.cloudflare_api_client.urlopen") as urlopen:
        with pytest.raises(CloudflareAPIError) as error:
            client.request("PATCH", "/zones/zone-123", required_permissions={"DNS Edit"}, resource_scope="/zones/zone-123", body={"paused": True})
        assert error.value.code == "CREDENTIAL_NOT_AUTHORIZED"
        urlopen.assert_not_called()


def test_never_falls_back_after_cloudflare_403(tmp_path):
    client = make_client(tmp_path)
    with patch("src.core.cloudflare_api_client.urlopen", side_effect=HTTPError("https://api.cloudflare.com/client/v4/zones/zone-123", 403, "Forbidden", {}, None)) as urlopen:
        with pytest.raises(CloudflareAPIError) as error:
            client.request("GET", "/zones/zone-123", required_permissions={"Zone Read"}, resource_scope="/zones/zone-123")
        assert error.value.code == "CLOUDFLARE_AUTHORIZATION_DENIED"
        assert urlopen.call_count == 1


def test_success_records_safe_audit_without_secret(tmp_path):
    records = []
    client = make_client(tmp_path, audit=records.append)
    class FakeResponse:
        status = 200
        def __enter__(self): return self
        def __exit__(self, *args): return False
        def read(self, _limit): return b'{"success":true,"result":{"id":"zone-123"}}'
    with patch("src.core.cloudflare_api_client.urlopen", return_value=FakeResponse()) as urlopen:
        result = client.request("GET", "/zones/zone-123", required_permissions={"Zone Read"}, resource_scope="/zones/zone-123")
    assert result["success"] is True
    assert records[0]["result"] == "success"
    assert "test-secret" not in repr(records)
    assert "test-secret" not in repr(urlopen.call_args)
