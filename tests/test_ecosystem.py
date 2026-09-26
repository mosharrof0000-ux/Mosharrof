"""
Mosharrof AI: Ecosystem Integration Test Engine
সব সাব-এজেন্ট, সেন্ট্রাল ব্রেইন ও ইউআই সত্তার হেলথ-চেক ও সংবেদনশীলতা টেস্ট করে।
"""

import unittest
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.entities.categories.base_category_entity import LivingCategoryEntity
from src.entities.ui_organ.sensory_engine import UISensoryEngine

class TestMosharrofEcosystem(unittest.TestCase):
    def test_core_brain_activation(self):
        """মাস্টার ব্রেণের সক্রিয়তা পরীক্ষা"""
        brain = MosharrofCoreBrain()
        self.assertEqual(brain.consciousness_state, "SUPREME_GOVERNANCE")

    def test_ui_sensory_perception(self):
        """ইউআই অর্গানের সেন্সর প্রতিক্রিয়া পরীক্ষা"""
        ui_sensor = UISensoryEngine()
        result = ui_sensor.analyze_user_behavior(scroll_speed=60.0, click_frequency=2, idle_time=1.0)
        self.assertEqual(result["perceived_mood"], "URGENT_OR_FAST_SCANNING")

    def test_living_entity_synchronization(self):
        """বিষয়ভিত্তিক সত্তার সাথে মাস্টার ব্রেণের সংযোগ পরীক্ষা"""
        philosophy_entity = LivingCategoryEntity("philosophy_domain", "Philosophy & Critical Thinking")
        status = philosophy_entity.sync_with_mosharrof_core("CHECK_HEALTH")
        self.assertTrue(status)

if __name__ == "__main__":
    unittest.main()
  
