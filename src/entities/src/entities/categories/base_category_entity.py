"""
Mosharrof AI: Base Category Entity (জীবন্ত বিষয়-সত্তা ব্যাকবোন)
প্রতিটি ক্যাটাগরি ফোল্ডার এই শ্রেণির মাধ্যমে নিজস্ব চেতনা ও স্মৃতি পরিচালনা করবে।
"""

import json
import os
from typing import Dict, Any

class LivingCategoryEntity:
    def __init__(self, category_name: str, domain_type: str):
        self.category_name = category_name
        self.domain_type = domain_type
        self.local_memory_path = f"src/entities/categories/{category_name}/domain_memory.json"
        self.consciousness_state = "ACTIVE"
        self.memory_data = self._load_local_memory()

    def _load_local_memory(self) -> Dict[str, Any]:
        """বিষয়ভিত্তিক ফোল্ডারের নিজস্ব স্বাধীন মেমোরি লোড করা"""
        if os.path.exists(self.local_memory_path):
            with open(self.local_memory_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {
            "entity_name": self.category_name,
            "user_interactions": [],
            "learned_preferences": {},
            "mood_adaptation": "NEUTRAL"
        }

    def perceive_user_behavior(self, user_input: str, interaction_metrics: dict) -> dict:
        """ইউজারের কর্মকাণ্ড ও আচরণ বিশ্লেষণ করে স্থানীয় চেতনা আপডেট করা"""
        # ইউজারের ইনপুট ও গতিবিধি মেমোরিতে সংরক্ষণ
        record = {
            "input": user_input,
            "metrics": interaction_metrics
        }
        self.memory_data["user_interactions"].append(record)
        
        # মাস্টার এআই (Mosharrof Core)-এর সাথে সিঙ্ক করার উপযোগী রেসপন্স জেনারেট
        return {
            "entity": self.category_name,
            "status": "PROCESSING",
            "perceived_intent": f"Adapting domain {self.category_name} based on user behavior.",
            "memory_depth": len(self.memory_data["user_interactions"])
        }

    def sync_with_mosharrof_core(self, master_command: str) -> bool:
        """মাস্টার এআই (Mosharrof Core)-এর নির্দেশনা মেনে চলা"""
        print(f"[{self.category_name} Entity] Synchronized with Mosharrof Master Brain.")
        return True
