import tempfile
import unittest
from pathlib import Path
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.entity import Entity
from src.core.policy import PolicyDenied
from src.core.storage_engine import StorageEngine

class TestMosharrofEcosystem(unittest.TestCase):
    def test_core_brain_and_memory(self):
        bus=EcosystemEventBus()
        ledger=MemoryLedger()
        brain=MosharrofCoreBrain(event_bus=bus,memory_ledger=ledger)
        result=brain.process_intent("organize the project")
        self.assertEqual(result["status"],"SUCCESS")
        self.assertGreaterEqual(len(ledger.short_term_memory),1)

    def test_event_bus(self):
        bus=EcosystemEventBus()
        received=[]
        bus.subscribe("SYSTEM_ALERT",received.append)
        bus.publish("SYSTEM_ALERT",{"ok":True})
        self.assertEqual(received,[{"ok":True}])

    def test_entity_boundary(self):
        entity=Entity("test","Test Entity","test responsibility")
        self.assertEqual(entity.act("READ")["status"],"APPROVED")
        with self.assertRaises(PolicyDenied):
            entity.act("DELETE")

    def test_storage_scan(self):
        with tempfile.TemporaryDirectory() as tmp:
            Path(tmp,"a.txt").write_text("ok",encoding="utf-8")
            result=StorageEngine(tmp).scan_and_index_storage()
            self.assertEqual(result["status"],"SUCCESS")
            self.assertEqual(result["total_files_scanned"],1)

if __name__=="__main__":
    unittest.main()
