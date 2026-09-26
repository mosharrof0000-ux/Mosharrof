"""
Mosharrof AI: UI Organ Sensory Engine
ইউজারের গতিবিধি, স্ক্রোলিং স্পিড এবং ইন্টারঅ্যাকশন বিশ্লেষণ করার সেন্সর মডিউল।
"""

import time
from typing import Dict, Any

class UISensoryEngine:
    def __init__(self):
        self.sensory_state = "PERCEIVING"

    def analyze_user_behavior(self, scroll_speed: float, click_frequency: int, idle_time: float) -> Dict[str, Any]:
        """ইউজারের আচার-আচরণ থেকে তার মানসিক অবস্থা নিরূপণ করা"""
        mood = "BALANCED"
        
        if idle_time > 10.0:
            mood = "HESITANT_OR_THINKING"
        elif scroll_speed > 50.0:
            mood = "URGENT_OR_FAST_SCANNING"
        elif click_frequency > 5:
            mood = "EXCITED_OR_EXPLORING"

        return {
            "perceived_mood": mood,
            "metrics": {
                "scroll_speed": scroll_speed,
                "click_frequency": click_frequency,
                "idle_time": idle_time
            },
            "recommended_ui_action": f"MUTATE_UI_THEME_FOR_{mood}"
      }
      
