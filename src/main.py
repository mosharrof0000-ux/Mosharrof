"""
Mosharrof AI: Main Runtime Orchestrator
সমগ্র স্বায়ত্তশাসিত এআই ইকোসিস্টেম স্টার্ট এবং রান করার প্রধান ফাইল।
"""

from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.entity_factory import EntityFactory
from src.entities.ui_organ.sensory_engine import UISensoryEngine
from src.entities.categories.base_category_entity import LivingCategoryEntity

def boot_mosharrof_ai():
    print("==========================================")
    print("   BOOTING MOSHARROF AI ECOSYSTEM...    ")
    print("==========================================")
    
    # ১. সেন্ট্রাল ব্রেইন স্টার্ট
    brain = MosharrofCoreBrain()
    print(f"[Core State]: {brain.system_status()}")
    
    # ২. ইউআই সেন্সরি ইঞ্জিন পরীক্ষা
    ui_sensor = UISensoryEngine()
    sensory_feedback = ui_sensor.analyze_user_behavior(scroll_speed=72.5, click_frequency=3, idle_time=0.5)
    print(f"[UI Perception]: {sensory_feedback['perceived_mood']} -> {sensory_feedback['recommended_ui_action']}")
    
    # ৩. এনটিটি ফ্যাক্টরি দিয়ে নতুন 'প্রযুক্তি' সত্তা জন্ম দেওয়া
    factory = EntityFactory()
    new_entity = factory.spawn_entity("technology_domain", "Technology & Innovation", "Logical, Precise, Futuristic")
    print(f"[Entity Factory]: Spawned '{new_entity['entity_name']}' at {new_entity['path']}")
    
    # ৪. নতুন সত্তার সাথে সেন্ট্রাল ব্রেইনের সিঙ্ক
    tech_entity = LivingCategoryEntity("technology_domain", "Technology & Innovation")
    tech_response = tech_entity.perceive_user_behavior("Exploring quantum computing", {"time_spent": 120})
    governance = brain.monitor_sub_agent("technology_domain", tech_response)
    print(f"[Governance Status]: {governance['decision']} -> {governance['master_command']}")
    
    print("==========================================")
    print("   MOSHARROF AI IS LIVE AND RUNNING!     ")
    print("==========================================")

if __name__ == "__main__":
    boot_mosharrof_ai()
  
