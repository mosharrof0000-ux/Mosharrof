"""Model-agnostic brain interface for Mosharrof entities."""

from typing import Any, Dict, Protocol


class BrainAdapter(Protocol):
    model_id: str

    def respond(self, input_text: str, context: Dict[str, Any] | None = None) -> Dict[str, Any]:
        """Return a normalized response without changing entity identity or policy."""
        ...
