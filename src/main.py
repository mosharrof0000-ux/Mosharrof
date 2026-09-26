"""
Mosharrof AI: Main Runtime Orchestrator (V2.0 with EventBus)
সমগ্র স্বায়ত্তশাসিত এআই ইকোসিস্টেম ও স্নায়ুতন্ত্রের পূর্ণাঙ্গ সমন্বয় ফাইল।
"""

from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.event_bus import EcosystemEventBus
from src.core.entity_factory import EntityFactory
from src.entities.ui_organ.sensory_engine import UISensoryEngine
from src.entities.categories.base_category_entity import LivingCategoryEntity

def boot_mosharrof_ai():
    print("==========================================")
    print("   BOOTING MOSHARROF AI ECOSYSTEM V2.0   ")
    print("==========================================")
    
    # ১. স্নায়ুতন্ত্র ও সেন্ট্রাল ব্রেইন স্টার্ট
    event_bus = EcosystemEventBus()
    brain = MosharrofCoreBrain(event_bus=event_bus)
    print(f"[Core State]: {brain.system_status()}")
    
    # ২. স্নায়ুতন্ত্রে লিসেনার যুক্ত করা
    def on_system_event(data):
        print(f"[Signal Receiver]: Event perceived across ecosystem -> {data}")

    event_bus.subscribe("USER_PERCEPTION", on_system_event)
    event_bus.subscribe("ENTITY_SPAWNED", on_system_event)
    
    # ৩. ইউআই সেন্সরি প্রতিক্রিয়া ও ব্রেইন ব্রডকাস্ট
    ui_sensor = UISensoryEngine()
    sensory_feedback = ui_sensor.analyze_user_behavior(scroll_speed=85.0, click_frequency=4, idle_time=0.2)
    brain.broadcast_system_command("USER_PERCEPTION", sensory_feedback)
    
    # ৪. এনটিটি ফ্যাক্টরি দিয়ে নতুন 'বিজ্ঞান ও প্রযুক্তি' সত্তা জন্ম দেওয়া
    factory = EntityFactory()
    new_entity = factory.spawn_entity("science_domain", "Science & Discovery", "Analytical, Empirical, Truth-Seeking")
    brain.broadcast_system_command("ENTITY_SPAWNED", new_entity)
    
    # ৫. নতুন সত্তার সাথে সেন্ট্রাল ব্রেইনের সিঙ্ক
    sci_entity = LivingCategoryEntity("science_domain", "Science & Discovery")
    sci_response = sci_entity.perceive_user_behavior("Analyzing quantum entanglement", {"depth": "HIGH"})
    governance = brain.monitor_sub_agent("science_domain", sci_response)
    print(f"[Governance Result]: {governance['decision']} -> {governance['master_command']}")
    
    print("==========================================")
    print("   MOSHARROF AI IS FULLY OPERATIONAL!    ")
    print("==========================================")

if __name__ == "__main__":
    boot_mosharrof_ai()
