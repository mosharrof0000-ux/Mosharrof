"""Machine-readable registry for Mosharrof entities."""
class EntityRegistry:
    def __init__(self):
        self._entities = {}
    def register(self, entity_id, *, responsibility, brain, permissions=None, state="ACTIVE"):
        self._entities[entity_id] = {"id": entity_id, "responsibility": responsibility,
                                     "brain": brain, "permissions": list(permissions or []), "state": state}
    def get(self, entity_id):
        return self._entities.get(entity_id)
    def all(self):
        return dict(self._entities)
