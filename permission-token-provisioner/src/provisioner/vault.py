"""Authenticated-encryption vault adapter for staging/single-instance deployments.

The encryption key must be injected by a trusted secret manager (never committed,
logged, or supplied by a browser). This module intentionally does not read env vars.
For multi-instance production, use a managed vault/KMS-backed implementation.
"""
from __future__ import annotations

import os
import secrets
import sqlite3
import uuid
from pathlib import Path
from typing import Protocol

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class Vault(Protocol):
    def put(self, secret_value: bytes) -> str: ...
    def get(self, handle: str) -> bytes: ...
    def delete(self, handle: str) -> None: ...


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

    def get(self, handle: str) -> bytes:
        entry_id = self._parse_handle(handle)
        with self._connect() as connection:
            row = connection.execute(
                "SELECT nonce, ciphertext FROM vault_entries WHERE id = ?", (entry_id,)
            ).fetchone()
        if row is None:
            raise KeyError("vault_entry_not_found")
        try:
            return self._cipher.decrypt(row[0], row[1], entry_id.encode("ascii"))
        except Exception:
            raise ValueError("vault_entry_authentication_failed") from None

    def delete(self, handle: str) -> None:
        entry_id = self._parse_handle(handle)
        with self._connect() as connection:
            cursor = connection.execute("DELETE FROM vault_entries WHERE id = ?", (entry_id,))
            if cursor.rowcount != 1:
                raise KeyError("vault_entry_not_found")
