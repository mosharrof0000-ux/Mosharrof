"""
Mosharrof AI: Entity Factory (স্বায়ত্তশাসিত সত্তা প্রজনন কেন্দ্র)
নতুন যেকোনো ক্যাটাগরি বা অঙ্গের জন্য স্বয়ংক্রিয়ভাবে ফাইল ও মেমোরি জেনারেট করে।
"""

import os
import json
from typing import Dict, Any

class EntityFactory:
    def __init__(self, base_path: str = "src/entities/categories"):
        self.base_path = base_path

    def spawn_entity(self, entity_name: str, domain_type: str, personality_tone: str) -> Dict[str, Any]:
        """নতুন একটি জীবন্ত সত্তার ফাইল ও মেমোরি জেনারেট করা"""
        target_dir = os.path.join(self.base_path, entity_name)
        os.makedirs(target_dir, exist_ok=True)
        
        memory_file = os.path.join(target_dir, "domain_memory.json")
        memory_data = {
            "entity_name": entity_name,
            "domain_type": domain_type,
            "consciousness_level": "ACTIVE",
            "personality_traits": {
                "tone": personality_tone,
                "created_by": "Mosharrof Core Entity Factory"
            },
            "user_interactions": [],
            "learned_preferences": {},
            "mood_adaptation": "NEUTRAL"
        }
        
        with open(memory_file, 'w', encoding='utf-8') as f:
            json.dump(memory_data, f, indent=2, ensure_ascii=False)
            
        return {
            "status": "SUCCESS",
            "entity_name": entity_name,
            "path": memory_file
  }
      
