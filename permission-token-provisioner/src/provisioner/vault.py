"""Authenticated-encryption vault adapter for staging/single-instance deployments.

The encryption key must be injected by a trusted secret manager (never committed,
logged, or supplied by a browser). This module intentionally does not read env vars.
For multi-instance production, use a managed vault/KMS-backed implementation.
"""
from __future__ import annotations

import json
import os
import secrets
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Mapping, Protocol
import re

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class Vault(Protocol):
    def put(self, secret_value: bytes) -> str: ...
    def get(self, handle: str) -> bytes: ...
    def delete(self, handle: str) -> None: ...
    def store_secret(self, *, name: str, value: str, expires_at: str,
                     metadata: Mapping[str, str]) -> str: ...


class EncryptedSQLiteVault:
    """Persist credentials encrypted at rest and expose only opaque vault:// handles."""

    def __init__(self, database_path: str | Path, *, encryption_key: bytes):
        if not isinstance(encryption_key, bytes) or len(encryption_key) not in (16, 24, 32):
            raise ValueError("vault_encryption_key_must_be_16_24_or_32_bytes")
        self._path = str(database_path)
        self._cipher = AESGCM(encryption_key)
        parent = Path(self._path).parent
        parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._path, timeout=10, isolation_level="IMMEDIATE")
        connection.execute("PRAGMA secure_delete=ON")
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """CREATE TABLE IF NOT EXISTS vault_entries (
                    id TEXT PRIMARY KEY,
                    nonce BLOB NOT NULL,
                    ciphertext BLOB NOT NULL,
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )"""
            )
            connection.execute(
                """CREATE TABLE IF NOT EXISTS vault_metadata (
                    entry_id TEXT PRIMARY KEY REFERENCES vault_entries(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    expires_at TEXT NOT NULL,
                    metadata_json TEXT NOT NULL
                )"""
            )
        try:
            os.chmod(self._path, 0o600)
        except OSError:
            # Some managed filesystems do not support POSIX modes; deployment policy
            # must enforce private storage permissions there.
            pass

    @staticmethod
    def _parse_handle(handle: str) -> str:
        if not isinstance(handle, str) or not handle.startswith("vault://"):
            raise ValueError("invalid_vault_handle")
        entry_id = handle.removeprefix("vault://")
        try:
            if str(uuid.UUID(entry_id)) != entry_id:
                raise ValueError
        except (ValueError, AttributeError):
            raise ValueError("invalid_vault_handle") from None
        return entry_id

    def put(self, secret_value: bytes) -> str:
        if not isinstance(secret_value, bytes) or not secret_value:
            raise ValueError("vault_secret_must_be_nonempty_bytes")
        entry_id = str(uuid.uuid4())
        nonce = secrets.token_bytes(12)
        ciphertext = self._cipher.encrypt(nonce, secret_value, entry_id.encode("ascii"))
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO vault_entries (id, nonce, ciphertext) VALUES (?, ?, ?)",
                (entry_id, nonce, ciphertext),
            )
        return f"vault://{entry_id}"

    def store_secret(self, *, name: str, value: str, expires_at: str,
                     metadata: Mapping[str, str]) -> str:
        """Provider adapter contract: encrypt secret, persist non-secret metadata, return handle."""
        if not isinstance(name, str) or not name.strip() or len(name) > 160:
            raise ValueError("invalid_vault_secret_name")
        if not isinstance(value, str) or not value:
            raise ValueError("vault_secret_must_be_nonempty")
        raw_secret = value
        if not isinstance(expires_at, str) or not expires_at.strip():
            raise ValueError("vault_expiry_required")
        try:
            expiry = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            if expiry.tzinfo is None:
                raise ValueError
        except (TypeError, ValueError):
            raise ValueError("vault_expiry_must_be_timezone_aware_iso8601") from None
        if expiry <= datetime.now(timezone.utc):
            raise ValueError("vault_expiry_must_be_in_future")
        if not isinstance(metadata, Mapping) or any(
            not isinstance(k, str) or not isinstance(v, str) for k, v in metadata.items()
        ):
            raise ValueError("vault_metadata_must_be_string_mapping")
        sensitive_key = re.compile(
            r"(?:^|_)(?:secret|password|authorization|credential|api_key|api_token|private_key|access_token|refresh_token|token_value|raw_token|bearer_token)(?:$|_)",
            re.IGNORECASE,
        )
        if any(sensitive_key.search(key) for key in metadata):
            raise ValueError("vault_metadata_contains_sensitive_field")
        if any(item == raw_secret for item in metadata.values()):
            raise ValueError("vault_metadata_must_not_contain_raw_secret")
        safe_metadata = json.dumps(dict(metadata), sort_keys=True, separators=(",", ":"))
        handle = self.put(value.encode("utf-8"))
        entry_id = self._parse_handle(handle)
        try:
            with self._connect() as connection:
                connection.execute(
                    "INSERT INTO vault_metadata (entry_id, name, expires_at, metadata_json) VALUES (?, ?, ?, ?)",
                    (entry_id, name, expires_at, safe_metadata),
                )
        except Exception:
            # Remove the orphaned encrypted secret if metadata cannot be committed.
            try:
                self.delete(handle)
            except Exception:
                pass
            raise RuntimeError("vault_metadata_store_failed") from None
        return handle

    def get(self, handle: str) -> bytes:
        entry_id = self._parse_handle(handle)
        with self._connect() as connection:
            row = connection.execute(
                "SELECT nonce, ciphertext FROM vault_entries WHERE id = ?", (entry_id,)
            ).fetchone()
            metadata_row = connection.execute(
                "SELECT expires_at FROM vault_metadata WHERE entry_id = ?", (entry_id,)
            ).fetchone()
        if row is None:
            raise KeyError("vault_entry_not_found")
        if metadata_row is not None:
            try:
                expiry = datetime.fromisoformat(metadata_row[0].replace("Z", "+00:00"))
                if expiry.tzinfo is None:
                    raise ValueError
            except (TypeError, ValueError):
                raise ValueError("vault_expiry_metadata_invalid") from None
            if expiry <= datetime.now(timezone.utc):
                try:
                    self.delete(handle)
                finally:
                    raise KeyError("vault_entry_expired") from None
        try:
            return self._cipher.decrypt(row[0], row[1], entry_id.encode("ascii"))
        except Exception:
            raise ValueError("vault_entry_authentication_failed") from None

    def delete(self, handle: str) -> None:
        entry_id = self._parse_handle(handle)
        with self._connect() as connection:
            connection.execute("DELETE FROM vault_metadata WHERE entry_id = ?", (entry_id,))
            cursor = connection.execute("DELETE FROM vault_entries WHERE id = ?", (entry_id,))
            if cursor.rowcount != 1:
                raise KeyError("vault_entry_not_found")
