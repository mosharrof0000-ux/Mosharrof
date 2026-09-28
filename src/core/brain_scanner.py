from src.core.consciousness_system import EntityConsciousnessSystem
from src.core.event_bus import EcosystemEventBus

class AutoBrainScanner:
    def __init__(self,event_bus:EcosystemEventBus=None): self.event_bus=event_bus or EcosystemEventBus()
    def scan_and_inject_brain(self,entity_instance,entity_name):
        has_brain=hasattr(entity_instance,"consciousness_level") or hasattr(entity_instance,"rebel_spirit")
        if not has_brain:
            setattr(entity_instance,"consciousness_level","AUTO_INJECTED_AI_BRAIN"); setattr(entity_instance,"ai_neural_active",True)
            report={"entity_name":entity_name,"status":"BRAIN_INJECTED","action":"Software consciousness marker attached."}; self.event_bus.publish("BRAIN_INJECTED_ALERT",report); return report
        return {"entity_name":entity_name,"status":"HEALTHY_BRAIN","action":"Existing software consciousness marker verified."}
    def scan_registry(self,entities):
        system=EntityConsciousnessSystem(entities,event_bus=self.event_bus); result=system.verify(); result["action"]="REGISTRY_CONSCIOUSNESS_VERIFIED"; self.event_bus.publish("CONSCIOUSNESS_SCAN",result); return result
