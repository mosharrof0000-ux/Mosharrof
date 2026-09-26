"""Mosharrof Core runtime entry point."""

from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.mosharrof_brain import MosharrofCoreBrain


def boot_mosharrof():
    event_bus = EcosystemEventBus()
    memory = MemoryLedger()
    brain = MosharrofCoreBrain(event_bus=event_bus, memory_ledger=memory)
    memory.record_event("BOOT_SEQUENCE", {"status": "SUCCESS"})
    return brain


boot_mosharrof_ai = boot_mosharrof


def main():
    brain = boot_mosharrof()
    print(brain.system_status())


if __name__ == "__main__":
    main()
