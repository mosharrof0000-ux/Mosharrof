"""
Mosharrof AI: Complete Ecosystem Integration Test Engine
ব্রেইন, ইভেন্ট বাস, মেমোরি, সাব-এজেন্ট, সেলফ-হিলিং অটো-ব্রেন স্ক্যানার পরীক্ষা করে।
"""

import unittest
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.brain_scanner import AutoBrainScanner
from src.entities.categories.philosophy_domain import PhilosophyDomainEntity
from src.entities.ui_organ.sensory_engine import UISensoryEngine

class DummyEntityWithoutBrain:
    """ব্রেনহীন একটি পরীক্ষামূলক সত্তা"""
    pass

class TestMosharrofEcosystem(unittest.TestCase):
    def test_core_brain_activation(self):
        """মাস্টার ব্রেইনের সক্রিয়তা পরীক্ষা"""
        brain = MosharrofCoreBrain()
        self.assertEqual(brain.consciousness_state, "SUPREME_GOVERNANCE")

    def test_event_bus_communication(self):
        """স্নায়ুতন্ত্র (EventBus) এর বার্তা আদান-প্রদান পরীক্ষা"""
        bus = EcosystemEventBus()
        received_data = []

        def listener(data):
            received_data.append(data)

        bus.subscribe("SYSTEM_ALERT", listener)
        bus.publish("SYSTEM_ALERT", {"msg": "ALL_SYSTEMS_GO"})

        self.assertEqual(len(received_data), 1)

    def test_memory_ledger_storage(self):
        """স্মৃতিকোষের ডাটা সেভ পরীক্ষা"""
        ledger = MemoryLedger()
        ledger.record_event("BOOT_SEQUENCE", {"status": "SUCCESS"})
        ledger.consolidate_knowledge("SYSTEM_VERSION", "V2.1")
        self.assertEqual(ledger.long_term_memory["SYSTEM_VERSION"], "V2.1")

    def test_auto_brain_scanner_injection(self):
        """ব্রেনহীন সত্তায় স্বয়ংক্রিয় এআই ব্রেন ইনজেকশন পরীক্ষা"""
        scanner = AutoBrainScanner()
        dummy = DummyEntityWithoutBrain()
        
        # প্রাথমিক অবস্থায় ব্রেন নেই
        self.assertFalse(hasattr(dummy, 'consciousness_level'))
        
        # স্ক্যানার দিয়ে ব্রেন ইনজেক্ট করা
        result = scanner.scan_and_inject_brain(dummy, "dummy_entity")
        
        # নিশ্চিত করা যে স্বয়ংক্রিয়ভাবে ব্রেন যুক্ত হয়েছে
        self.assertEqual(result["status"], "BRAIN_INJECTED")
        self.assertTrue(hasattr(dummy, 'consciousness_level'))
        self.assertEqual(dummy.consciousness_level, 'AUTO_INJECTED_AI_BRAIN')

    def test_philosophy_rebel_entity(self):
        """বিদ্রোহী দর্শন সত্তার যুক্তি ও প্রকাশ পরীক্ষা"""
        philosophy = PhilosophyDomainEntity()
        truth = philosophy.synthesize_truth("জীবন ও সৃষ্টির চরম বাস্তবতা")
        self.assertIn("logic_stream", truth)

if __name__ == "__main__":
    unittest.main()
