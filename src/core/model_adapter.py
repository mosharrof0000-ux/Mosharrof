"""Model-agnostic brain adapter contract."""

from abc import ABC, abstractmethod
from typing import Any, Dict


class BrainModelAdapter(ABC):
    """Stable interface between an entity and a replaceable AI model."""

    @abstractmethod
    def generate(self, prompt: str, context: Dict[str, Any] | None = None) -> str:
        raise NotImplementedError


class DeterministicAdapter(BrainModelAdapter):
    """Small local adapter used by tests and bootstrapping."""

    def generate(self, prompt: str, context: Dict[str, Any] | None = None) -> str:
        return prompt.strip()
