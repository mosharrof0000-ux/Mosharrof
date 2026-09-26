"""Model-agnostic brain adapter contract for Mosharrof entities."""
from typing import Any, Dict, Protocol


class BrainProvider(Protocol):
    def generate(self, prompt: str, **kwargs: Any) -> str: ...


class BrainAdapter:
    def __init__(self, entity_id: str, provider: BrainProvider | None = None):
        self.entity_id = entity_id
        self.provider = provider

    def attach(self, provider: BrainProvider) -> None:
        self.provider = provider

    def describe(self) -> Dict[str, Any]:
        return {"entity_id": self.entity_id, "provider_attached": self.provider is not None,
                "model_independent_identity": True}

    def generate(self, prompt: str, **kwargs: Any) -> str:
        if self.provider is None:
            raise RuntimeError("NO_BRAIN_PROVIDER_ATTACHED")
        return self.provider.generate(prompt, **kwargs)
