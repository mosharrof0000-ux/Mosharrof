"""Model adapter boundary. The entity identity does not depend on a specific model provider."""


class ModelAdapter:
    def __init__(self, provider: str = "unconfigured", model: str = "unconfigured"):
        self.provider = provider
        self.model = model

    def describe(self):
        return {
            "provider": self.provider,
            "model": self.model,
            "replaceable": True
        }
