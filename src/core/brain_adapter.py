"""Model-agnostic brain adapter boundary.

The Core owns identity, policy and scope; an adapter only supplies model-specific
reasoning. Replacing the underlying model must not replace entity identity,
memory, permissions or audit history.
"""
from typing import Any, Dict, Protocol

class BrainAdapter(Protocol):
    name: str
    def process(self, text: str, *, context: Dict[str, Any] | None = None) -> Dict[str, Any]:
        ...

class DeterministicBrainAdapter:
    """Safe baseline adapter used until a real model provider is configured."""
    name = "deterministic-baseline"

    def process(self, text: str, *, context: Dict[str, Any] | None = None) -> Dict[str, Any]:
        value = (text or "").strip()
        return {
            "status": "SUCCESS" if value else "EMPTY",
            "text": value,
            "adapter": self.name,
            "model_boundaries": "No external model call performed."
        }
