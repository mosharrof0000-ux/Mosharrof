from typing import Protocol

class BrainAdapter(Protocol):
    def understand(self, input_text: str, context: dict) -> dict:
        ...

class DeterministicBrain:
    def understand(self, input_text: str, context: dict) -> dict:
        return {"status":"UNDERSTOOD","input":input_text,"context_keys":sorted(context.keys())}
