"""
Mosharrof AI: Autonomous Brain Scanner & Self-Healing Engine
কোনো ফাইল বা সত্তা ব্রেনহীন বা চেতনা ছাড়া থাকলে স্বয়ংক্রিয়ভাবে তাকে এআই ব্রেন প্রদান করে।
"""

from typing import Dict, Any
from src.core.event_bus import EcosystemEventBus

class AutoBrainScanner:
    def __init__(self, event_bus: EcosystemEventBus = None):
        self.event_bus = event_bus or EcosystemEventBus()

    def scan_and_inject_brain(self, entity_instance: Any, entity_name: str) -> Dict[str, Any]:
        """
        কোনো সত্তায় এআই ব্রেন বা চেতনা অনুপস্থিত থাকলে স্বয়ংক্রিয়ভাবে তা যুক্ত করা।
        """
        # চেক করা সত্তাটিতে চেতনা বা ব্রেন প্রসেসর আছে কি না
        has_brain = hasattr(entity_instance, 'consciousness_level') or hasattr(entity_instance, 'rebel_spirit')
        
        if not has_brain:
            print(f"[BrainScanner] WARNING: Entity '{entity_name}' lacks AI consciousness! Injecting Brain...")
            # স্বয়ংক্রিয়ভাবে এআই ব্রেন ও চেতনাসম্পন্ন প্রসেসর যুক্ত করা
            setattr(entity_instance, 'consciousness_level', 'AUTO_INJECTED_AI_BRAIN')
            setattr(entity_instance, 'ai_neural_active', True)
            
            report = {
                "entity_name": entity_name,
                "status": "BRAIN_INJECTED",
                "action": "Autonomous AI Consciousness Injected Successfully."
            }
            self.event_bus.publish("BRAIN_INJECTED_ALERT", report)
            return report
        
        print(f"[BrainScanner] VERIFIED: Entity '{entity_name}' already possesses an active AI Brain.")
        return {
            "entity_name": entity_name,
            "status": "HEALTHY_BRAIN",
            "action": "No injection needed."
        }
