"""Mosharrof Core runtime entry point.

The runtime is deliberately small: the Core coordinates registered entities,
while capability is enforced by permission, policy, scope and identity.
Legacy domain modules remain available but are not booted implicitly.
"""
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger

def boot_mosharrof():
    event_bus = EcosystemEventBus()
    memory = MemoryLedger()
    brain = MosharrofCoreBrain(event_bus=event_bus, memory_ledger=memory)
    memory.record_event("BOOT_SEQUENCE", {"status": "SUCCESS"})
    return brain

def main():
    brain = boot_mosharrof()
    print(brain.system_status())

if __name__ == "__main__":
    main()
