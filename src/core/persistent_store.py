"""
Persistent Store — The eternal substrate of entity memory and history.

Design principles:
- Every piece of long-term state must survive process death.
- Storage is append-mostly and audit-friendly.
- No silent overwrites of historical truth.
- Ordinary key-value is not enough; we preserve continuity of identity.

This is not a cache. This is the civilizational record.
"""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional


class PersistentStore:
    """
    File-backed persistent store with strong guarantees.

    Layout:
        data/entities/<entity_id>/
            meta.json          — identity & lifecycle state
            memory.jsonl      — append-only short + long term events
            archive.json       — sealed record after death (immutable)
    """

    def __init__(self, root: str = "data/entities"):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def _entity_dir(self, entity_id: str) -> Path:
        path = self.root / entity_id
        path.mkdir(parents=True, exist_ok=True)
        return path

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    # ── Meta (identity + lifecycle) ─────────────────────────────────────

    def load_meta(self, entity_id: str) -> Dict[str, Any]:
        meta_path = self._entity_dir(entity_id) / "meta.json"
        if not meta_path.exists():
            return {
                "entity_id": entity_id,
                "lifecycle": "UNBORN",
                "born_at": None,
                "retired_at": None,
                "archived_at": None,
                "created_at": self._now(),
            }
        return json.loads(meta_path.read_text(encoding="utf-8"))

    def save_meta(self, entity_id: str, meta: Dict[str, Any]) -> None:
        meta_path = self._entity_dir(entity_id) / "meta.json"
        meta["updated_at"] = self._now()
        meta_path.write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")

    # ── Memory (append-only) ────────────────────────────────────────────

    def append_memory(self, entity_id: str, event: Dict[str, Any]) -> None:
        """Append-only. History is never rewritten."""
        mem_path = self._entity_dir(entity_id) / "memory.jsonl"
        event = dict(event)
        event.setdefault("recorded_at", self._now())
        with mem_path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(event, ensure_ascii=False) + "\n")

    def load_memory(self, entity_id: str, *, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        mem_path = self._entity_dir(entity_id) / "memory.jsonl"
        if not mem_path.exists():
            return []
        lines = mem_path.read_text(encoding="utf-8").strip().splitlines()
        events = [json.loads(line) for line in lines if line.strip()]
        if limit is not None:
            return events[-limit:]
        return events

    # ── Archive (immutable after death) ─────────────────────────────────

    def seal_archive(self, entity_id: str, full_record: Dict[str, Any]) -> None:
        """
        Create an immutable archive.
        Once written, this file must never be modified by ordinary means.
        """
        archive_path = self._entity_dir(entity_id) / "archive.json"
        if archive_path.exists():
            raise RuntimeError(f"Archive for '{entity_id}' already sealed. Immutable.")

        record = dict(full_record)
        record["sealed_at"] = self._now()
        record["immutable"] = True
        archive_path.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")

        # Best-effort make read-only on supporting filesystems
        try:
            os.chmod(archive_path, 0o444)
        except OSError:
            pass

    def load_archive(self, entity_id: str) -> Optional[Dict[str, Any]]:
        archive_path = self._entity_dir(entity_id) / "archive.json"
        if not archive_path.exists():
            return None
        return json.loads(archive_path.read_text(encoding="utf-8"))

    def list_entities(self) -> List[str]:
        if not self.root.exists():
            return []
        return sorted([p.name for p in self.root.iterdir() if p.is_dir()])
