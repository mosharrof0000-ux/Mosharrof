"""
Mosharrof Event Bus
A small, fault-isolated communication layer for entity-to-entity signals.
"""

from typing import Dict, Any, List, Callable


class EcosystemEventBus:
    def __init__(self):
        self.subscribers: Dict[str, List[Callable]] = {}

    def subscribe(self, event_type: str, callback: Callable):
        if not callable(callback):
            raise TypeError("callback must be callable")
        self.subscribers.setdefault(event_type, []).append(callback)

    def publish(self, event_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Publish without allowing one subscriber exception to crash the bus."""
        delivered = 0
        failures = []
        for callback in list(self.subscribers.get(event_type, [])):
            try:
                callback(data)
                delivered += 1
            except Exception as exc:
                failures.append({
                    "callback": getattr(callback, "__name__", repr(callback)),
                    "error": str(exc),
                })
        return {
            "event_type": event_type,
            "delivered": delivered,
            "failures": failures,
            "status": "SUCCESS" if not failures else "PARTIAL_FAILURE",
        }
