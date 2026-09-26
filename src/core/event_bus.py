from typing import Any, Callable, Dict, List

class EcosystemEventBus:
    """Small synchronous event bus for controlled entity-to-entity messages."""
    def __init__(self):
        self.subscribers: Dict[str, List[Callable[[Dict[str, Any]], None]]] = {}

    def subscribe(self, event_type: str, callback):
        self.subscribers.setdefault(event_type, []).append(callback)

    def publish(self, event_type: str, data: Dict[str, Any]):
        for callback in list(self.subscribers.get(event_type, [])):
            callback(data)
