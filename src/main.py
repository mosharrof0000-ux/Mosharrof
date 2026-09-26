from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.registry import EntityRegistry

def boot_mosharrof_ai():
    event_bus = EcosystemEventBus()
    memory = MemoryLedger()
    registry = EntityRegistry()
    registry.load()
    brain = MosharrofCoreBrain(event_bus=event_bus, memory_ledger=memory)
    memory.record_event("BOOT_SEQUENCE", {"status": "SUCCESS", "version": brain.version})
    return {"status": "SUCCESS", "core": brain.system_status(), "entities": [e.manifest() for e in registry.list()]}

if __name__ == "__main__":
    print(boot_mosharrof_ai())
