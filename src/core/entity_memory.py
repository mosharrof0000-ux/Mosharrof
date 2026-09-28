"""Per-entity persistent memory for Mosharrof entities.

Every registered entity receives its own isolated short-term and long-term
memory boundary. This is software memory only — no sentience claim.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


class EntityMemory:
    """Isolated memory store for a single entity."""

    def __init__(self, entity_id: str):
        self.entity_id = entity_id
        self.short_term: List[Dict[str, Any]] = []
        self.long_term: Dict[str, Any] = {}
        self.created_at = self._now()
        self.last_access = self.created_at

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    def remember(self, event_type: str, payload: Dict[str, Any], *, permanent: bool = False) -> Dict[str, Any]:
        entry = {
            "timestamp": self._now(),
            "event_type": event_type,
            "payload": dict(payload),
        }
        self.short_term.append(entry)
        self.last_access = entry["timestamp"]
        if permanent:
            key = f"{event_type}:{entry['timestamp']}"
            self.long_term[key] = entry
        return {"status": "RECORDED", "entity_id": self.entity_id, "permanent": permanent}

    def recall(self, *, limit: int = 10, event_type: Optional[str] = None) -> List[Dict[str, Any]]:
        self.last_access = self._now()
        items = self.short_term
        if event_type:
            items = [e for e in items if e["event_type"] == event_type]
        return list(reversed(items[-limit:]))

    def consolidate(self, key: str, data: Any) -> Dict[str, Any]:
        self.long_term[key] = {
            "data": data,
            "consolidated_at": self._now(),
        }
        self.last_access = self._now()
        return {"status": "CONSOLIDATED", "entity_id": self.entity_id, "key": key}

    def inspect(self) -> Dict[str, Any]:
        return {
            "entity_id": self.entity_id,
            "short_term_count": len(self.short_term),
            "long_term_count": len(self.long_term),
            "created_at": self.created_at,
            "last_access": self.last_access,
            "recent": self.recall(limit=3),
        }


class EntityMemoryBank:
    """Central bank that holds isolated memory for every registered entity."""

    def __init__(self):
        self._memories: Dict[str, EntityMemory] = {}

    def get_or_create(self, entity_id: str) -> EntityMemory:
        if entity_id not in self._memories:
            self._memories[entity_id] = EntityMemory(entity_id)
        return self._memories[entity_id]

    def remember(self, entity_id: str, event_type: str, payload: Dict[str, Any], *, permanent: bool = False) -> Dict[str, Any]:
        return self.get_or_create(entity_id).remember(event_type, payload, permanent=permanent)

    def recall(self, entity_id: str, *, limit: int = 10, event_type: Optional[str] = None) -> List[Dict[str, Any]]:
        return self.get_or_create(entity_id).recall(limit=limit, event_type=event_type)

    def consolidate(self, entity_id: str, key: str, data: Any) -> Dict[str, Any]:
        return self.get_or_create(entity_id).consolidate(key, data)

    def inspect(self, entity_id: str) -> Dict[str, Any]:
        return self.get_or_create(entity_id).inspect()

    def inspect_all(self) -> Dict[str, Any]:
        return {
            "status": "ACTIVE",
            "entity_count": len(self._memories),
            "entities": {eid: mem.inspect() for eid, mem in sorted(self._memories.items())},
        }
