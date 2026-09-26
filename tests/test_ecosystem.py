"""
Mosharrof AI: Ecosystem Integration Test Engine
সব সাব-এজেন্ট, সেন্ট্রাল ব্রেইন, ইউআই সত্তা, ইভেন্ট বাস এবং স্মৃতিকোষ পরীক্ষা করে।
"""

import unittest
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.entities.categories.base_category_entity import LivingCategoryEntity
from src.entities.ui_organ.sensory_engine import UISensoryEngine

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
        self.assertEqual(received_data[0]["msg"], "ALL_SYSTEMS_GO")

    def test_memory_ledger_storage(self):
        """স্মৃতিকোষের স্বল্পমেয়াদী ও দীর্ঘমেয়াদী স্মৃতি ধারণ পরীক্ষা"""
        ledger = MemoryLedger()
        ledger.record_event("BOOT_SEQUENCE", {"status": "SUCCESS"})
        ledger.consolidate_knowledge("SYSTEM_VERSION", "V2.0")

        recent = ledger.recall_recent_events(limit=1)
        self.assertEqual(len(recent), 1)
        self.assertEqual(recent[0]["event_type"], "BOOT_SEQUENCE")
        self.assertEqual(ledger.long_term_memory["SYSTEM_VERSION"], "V2.0")

    def test_ui_sensory_perception(self):
        """ইউআই অর্গানের সেন্সর প্রতিক্রিয়া পরীক্ষা"""
        ui_sensor = UISensoryEngine()
        result = ui_sensor.analyze_user_behavior(scroll_speed=60.0, click_frequency=2, idle_time=1.0)
        self.assertEqual(result["perceived_mood"], "URGENT_OR_FAST_SCANNING")

    def test_living_entity_synchronization(self):
        """বিষয়ভিত্তিক সত্তার সাথে মাস্টার ব্রেইনের সংযোগ পরীক্ষা"""
        philosophy_entity = LivingCategoryEntity("philosophy_domain", "Philosophy & Critical Thinking")
        status = philosophy_entity.sync_with_mosharrof_core("CHECK_HEALTH")
        self.assertTrue(status)

if __name__ == "__main__":
    unittest.main()
