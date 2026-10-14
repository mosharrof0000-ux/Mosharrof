import sqlite3

import pytest

from provisioner.vault import EncryptedSQLiteVault


KEY = b"0123456789abcdef0123456789abcdef"


def test_round_trip_returns_only_opaque_handle(tmp_path):
    vault = EncryptedSQLiteVault(tmp_path / "vault.db", encryption_key=KEY)
    secret = b"provider-token-do-not-log"
    handle = vault.put(secret)
    assert handle.startswith("vault://")
    assert secret.decode() not in handle
    assert vault.get(handle) == secret


def test_secret_is_not_stored_as_plaintext(tmp_path):
    path = tmp_path / "vault.db"
    secret = b"highly-sensitive-provider-token"
    vault = EncryptedSQLiteVault(path, encryption_key=KEY)
    handle = vault.put(secret)
    with sqlite3.connect(path) as connection:
        nonce, ciphertext = connection.execute(
            "SELECT nonce, ciphertext FROM vault_entries WHERE id = ?",
            (handle.removeprefix("vault://"),),
        ).fetchone()
    assert secret not in nonce
    assert secret not in ciphertext
    assert len(nonce) == 12


def test_provider_adapter_contract_stores_encrypted_secret_and_metadata(tmp_path):
    path = tmp_path / "vault.db"
    vault = EncryptedSQLiteVault(path, encryption_key=KEY)
    secret = "provider-token-never-returned"
    handle = vault.store_secret(
        name="staging-test",
        value=secret,
        expires_at="2026-10-15T00:00:00Z",
        metadata={"provider": "github", "scope": "repo:read"},
    )
    assert handle.startswith("vault://")
    assert vault.get(handle) == secret.encode()
    with sqlite3.connect(path) as connection:
        nonce, ciphertext = connection.execute(
            "SELECT nonce, ciphertext FROM vault_entries WHERE id = ?",
            (handle.removeprefix("vault://"),),
        ).fetchone()
        name, expires_at, metadata = connection.execute(
            "SELECT name, expires_at, metadata_json FROM vault_metadata WHERE entry_id = ?",
            (handle.removeprefix("vault://"),),
        ).fetchone()
    assert secret.encode() not in ciphertext
    assert name == "staging-test"
    assert expires_at == "2026-10-15T00:00:00Z"
    assert '"provider":"github"' in metadata


def test_wrong_key_fails_closed(tmp_path):
    path = tmp_path / "vault.db"
    handle = EncryptedSQLiteVault(path, encryption_key=KEY).put(b"secret")
    other = EncryptedSQLiteVault(
        path, encryption_key=b"abcdef0123456789abcdef0123456789"
    )
    with pytest.raises(ValueError, match="vault_entry_authentication_failed"):
        other.get(handle)


def test_tampered_ciphertext_fails_closed(tmp_path):
    path = tmp_path / "vault.db"
    vault = EncryptedSQLiteVault(path, encryption_key=KEY)
    handle = vault.put(b"secret")
    with sqlite3.connect(path) as connection:
        connection.execute(
            "UPDATE vault_entries SET ciphertext = ? WHERE id = ?",
            (b"tampered", handle.removeprefix("vault://")),
        )
    with pytest.raises(ValueError, match="vault_entry_authentication_failed"):
        vault.get(handle)


def test_invalid_handle_is_rejected(tmp_path):
    vault = EncryptedSQLiteVault(tmp_path / "vault.db", encryption_key=KEY)
    with pytest.raises(ValueError, match="invalid_vault_handle"):
        vault.get("vault://../../not-a-uuid")


def test_missing_entry_and_invalid_key_are_rejected(tmp_path):
    with pytest.raises(ValueError, match="vault_encryption_key_must_be"):
        EncryptedSQLiteVault(tmp_path / "bad.db", encryption_key=b"short")
    vault = EncryptedSQLiteVault(tmp_path / "vault.db", encryption_key=KEY)
    with pytest.raises(KeyError, match="vault_entry_not_found"):
        vault.get("vault://00000000-0000-0000-0000-000000000000")


def test_delete_removes_secret_and_metadata(tmp_path):
    path = tmp_path / "vault.db"
    vault = EncryptedSQLiteVault(path, encryption_key=KEY)
    handle = vault.store_secret(
        name="delete-test", value="secret", expires_at="2099-01-01T00:00:00Z",
        metadata={"provider": "test"},
    )
    vault.delete(handle)
    with sqlite3.connect(path) as connection:
        assert connection.execute("SELECT 1 FROM vault_entries").fetchone() is None
        assert connection.execute("SELECT 1 FROM vault_metadata").fetchone() is None



def test_metadata_rejects_sensitive_field_names_and_raw_secret(tmp_path):
    vault = EncryptedSQLiteVault(tmp_path / "vault.db", encryption_key=KEY)
    with pytest.raises(ValueError, match="vault_metadata_contains_sensitive_field"):
        vault.store_secret(
            name="metadata-test", value="raw-secret",
            expires_at="2099-01-01T00:00:00Z",
            metadata={"api_key": "other"},
        )
    with pytest.raises(ValueError, match="vault_metadata_must_not_contain_raw_secret"):
        vault.store_secret(
            name="metadata-test", value="raw-secret",
            expires_at="2099-01-01T00:00:00Z",
            metadata={"note": "raw-secret"},
        )


def test_store_secret_rejects_invalid_or_naive_expiry(tmp_path):
    vault = EncryptedSQLiteVault(tmp_path / "vault.db", encryption_key=KEY)
    with pytest.raises(ValueError, match="vault_expiry_must_be_timezone_aware_iso8601"):
        vault.store_secret(
            name="expiry-test", value="secret", expires_at="2099-01-01T00:00:00",
            metadata={"provider": "test"},
        )
    with pytest.raises(ValueError, match="vault_expiry_must_be_in_future"):
        vault.store_secret(
            name="expiry-test", value="secret", expires_at="2000-01-01T00:00:00Z",
            metadata={"provider": "test"},
        )


def test_expired_secret_cannot_be_read_and_is_deleted(tmp_path):
    path = tmp_path / "vault.db"
    vault = EncryptedSQLiteVault(path, encryption_key=KEY)
    handle = vault.store_secret(
        name="expired-test", value="expired-secret",
        expires_at="2099-01-01T00:00:00Z", metadata={"provider": "test"},
    )
    with sqlite3.connect(path) as connection:
        connection.execute(
            "UPDATE vault_metadata SET expires_at = ? WHERE entry_id = ?",
            ("2000-01-01T00:00:00Z", handle.removeprefix("vault://")),
        )
    with pytest.raises(KeyError, match="vault_entry_expired"):
        vault.get(handle)
    with sqlite3.connect(path) as connection:
        assert connection.execute("SELECT 1 FROM vault_entries").fetchone() is None
        assert connection.execute("SELECT 1 FROM vault_metadata").fetchone() is None
