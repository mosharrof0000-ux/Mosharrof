"""Model-agnostic adapter contract."""
from abc import ABC, abstractmethod
class ModelAdapter(ABC):
    @abstractmethod
    def generate(self, messages, **kwargs): raise NotImplementedError
class DeterministicAdapter(ModelAdapter):
    def generate(self, messages, **kwargs): return {"status":"OK","model":"deterministic-adapter","messages":messages}
