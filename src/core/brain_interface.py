"""Stable interface between an entity and any future/current AI model."""


class BrainInterface:
    def think(self, task: str, context=None):
        raise NotImplementedError

    def health(self):
        return {"status": "DEFINED", "model_agnostic": True}
