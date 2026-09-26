"""Machine-readable registry for all Mosharrof entities."""
class EntityRegistry:
    def __init__(self): self._entities={}
    def register(self, entity_id, *, role, brain, scope): self._entities[entity_id]={"id":entity_id,"role":role,"brain":brain,"scope":scope}
    def get(self, entity_id): return self._entities.get(entity_id)
    def list(self): return list(self._entities.values())
