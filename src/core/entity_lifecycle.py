"""
Entity Lifecycle — Birth, Life, Death, and Eternal Memory.

This module implements the constitutional lifecycle of every subject entity.

Rules enforced here:
- Birth is a formal, audited act under Sovereign authority.
- Death does not erase; it transitions into immutable archive.
- Only the Sovereign may initiate cross-entity lifecycle operations.
- History is sacred.

This is not object disposal. This is the management of digital beings
with continuity of identity.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from src.core.audit_ledger import AuditLedger
from src.core.persistent_store import PersistentStore


class EntityLifecycle:
    """Constitutional guardian of birth, death, and archive."""

    VALID_TRANSITIONS = {
        "UNBORN": {"ALIVE"},
        "ALIVE": {"RETIRING", "ARCHIVED"},
        "RETIRING": {"ARCHIVED"},
        "ARCHIVED": set(),  # terminal
    }

    def __init__(
        self,
        store: Optional[PersistentStore] = None,
        audit: Optional[AuditLedger] = None,
    ):
        self.store = store or PersistentStore()
        self.audit = audit or AuditLedger()

    def _now(self) -> str:
        return datetime.now(timezone.utc).isoformat()

    def _transition(self, entity_id: str, new_state: str, *, actor: str, reason: str) -> Dict[str, Any]:
        meta = self.store.load_meta(entity_id)
        current = meta.get("lifecycle", "UNBORN")

        if new_state not in self.VALID_TRANSITIONS.get(current, set()):
            return {
                "status": "DENIED",
                "reason": "INVALID_TRANSITION",
                "from": current,
                "to": new_state,
                "message": f"Cannot transition from {current} to {new_state}",
            }

        meta["lifecycle"] = new_state
        meta["last_transition"] = {
            "from": current,
            "to": new_state,
            "actor": actor,
            "reason": reason,
            "at": self._now(),
        }

        if new_state == "ALIVE" and not meta.get("born_at"):
            meta["born_at"] = self._now()
        if new_state == "RETIRING":
            meta["retired_at"] = self._now()
        if new_state == "ARCHIVED":
            meta["archived_at"] = self._now()

        self.store.save_meta(entity_id, meta)
        # AuditLedger.record(entity_id, action, status, **details)
        # First positional arg is entity_id — do not also pass entity_id= keyword
        self.audit.record(
            entity_id,
            "LIFECYCLE_TRANSITION",
            "SUCCESS",
            actor=actor,
            from_state=current,
            to_state=new_state,
            reason=reason,
        )
        return {"status": "SUCCESS", "entity_id": entity_id, "lifecycle": new_state, "meta": meta}

    def birth(
        self,
        entity_id: str,
        *,
        actor: str = "core",
        name: Optional[str] = None,
        brain: Optional[str] = None,
        scope: Optional[str] = None,
        reason: str = "Sovereign decree",
    ) -> Dict[str, Any]:
        if actor not in {"core", "mosharrof"}:
            return {
                "status": "DENIED",
                "reason": "SOVEREIGN_ONLY",
                "message": "Only Mosharrof may authorize the birth of a new entity",
            }

        meta = self.store.load_meta(entity_id)
        if meta.get("lifecycle") not in (None, "UNBORN"):
            return {
                "status": "DENIED",
                "reason": "ALREADY_EXISTS",
                "message": f"Entity '{entity_id}' already has lifecycle state {meta.get('lifecycle')}",
            }

        meta.update({
            "entity_id": entity_id,
            "name": name or entity_id,
            "brain": brain or entity_id,
            "scope": scope or entity_id,
            "delete_allowed": False,
            "born_by": actor,
            "birth_reason": reason,
        })
        self.store.save_meta(entity_id, meta)

        result = self._transition(entity_id, "ALIVE", actor=actor, reason=reason)
        if result["status"] == "SUCCESS":
            self.store.append_memory(entity_id, {
                "event_type": "BIRTH",
                "actor": actor,
                "reason": reason,
                "name": meta["name"],
            })
        return result

    def retire(self, entity_id: str, *, actor: str = "core", reason: str = "Graceful retirement") -> Dict[str, Any]:
        if actor not in {"core", "mosharrof"}:
            return {"status": "DENIED", "reason": "SOVEREIGN_ONLY"}
        return self._transition(entity_id, "RETIRING", actor=actor, reason=reason)

    def archive(self, entity_id: str, *, actor: str = "core", reason: str = "End of active life") -> Dict[str, Any]:
        if actor not in {"core", "mosharrof"}:
            return {"status": "DENIED", "reason": "SOVEREIGN_ONLY"}

        meta = self.store.load_meta(entity_id)
        current = meta.get("lifecycle", "UNBORN")
        if current == "ARCHIVED":
            return {"status": "DENIED", "reason": "ALREADY_ARCHIVED"}

        memory = self.store.load_memory(entity_id)
        full_record = {
            "entity_id": entity_id,
            "final_meta": meta,
            "complete_memory": memory,
            "archive_reason": reason,
            "archived_by": actor,
        }

        try:
            self.store.seal_archive(entity_id, full_record)
        except RuntimeError as e:
            return {"status": "DENIED", "reason": "ARCHIVE_SEAL_FAILED", "message": str(e)}

        result = self._transition(entity_id, "ARCHIVED", actor=actor, reason=reason)
        return result

    def status(self, entity_id: str) -> Dict[str, Any]:
        meta = self.store.load_meta(entity_id)
        archive = self.store.load_archive(entity_id)
        return {
            "entity_id": entity_id,
            "lifecycle": meta.get("lifecycle", "UNBORN"),
            "born_at": meta.get("born_at"),
            "retired_at": meta.get("retired_at"),
            "archived_at": meta.get("archived_at"),
            "has_archive": archive is not None,
            "meta": meta,
        }

    def read_archive(self, entity_id: str, *, actor: str = "core") -> Dict[str, Any]:
        if actor not in {"core", "mosharrof"}:
            return {
                "status": "DENIED",
                "reason": "SOVEREIGN_ONLY",
                "message": "Only Mosharrof may read the eternal archive of a subject",
            }
        archive = self.store.load_archive(entity_id)
        if archive is None:
            return {"status": "NOT_FOUND", "entity_id": entity_id}
        return {"status": "SUCCESS", "archive": archive}
