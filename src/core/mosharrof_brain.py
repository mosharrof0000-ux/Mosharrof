from typing import Any, Dict, Optional
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger

class MosharrofCoreBrain:
    def __init__(self, event_bus: Optional[EcosystemEventBus] = None, memory_ledger: Optional[MemoryLedger] = None):
        self.system_name = 'Mosharrof AI Core'
        self.consciousness_state = 'CORE_COORDINATION'
        self.security_protocol = 'NO_DELETE'
        self.event_bus = event_bus or EcosystemEventBus()
        self.memory_ledger = memory_ledger or MemoryLedger()
        self.active_entities = ['core', 'chat_box', 'sidebar', 'ui', 'tools']

    def broadcast_system_command(self, command_type: str, payload: Dict[str, Any]) -> None:
        self.event_bus.publish(command_type, payload)
        self.memory_ledger.record_event('SYSTEM_COMMAND', {'command_type': command_type, 'payload': payload})

    def monitor_sub_agent(self, entity_name: str, action_report: Dict[str, Any]) -> Dict[str, Any]:
        operation = str(action_report.get('operation', '')).upper()
        if operation == 'DELETE' or action_report.get('destructive') is True:
            result = {'decision':'REJECTED','master_command':'Delete and destructive operations are permanently blocked.','integrity_check':'FAILED'}
        elif action_report.get('status') == 'PROCESSING':
            result = {'decision':'APPROVED','master_command':f'Proceed within the assigned scope for {entity_name}.','integrity_check':'PASSED'}
        else:
            result = {'decision':'REJECTED','master_command':'Action requires an explicit processing state.','integrity_check':'FAILED'}
        self.memory_ledger.record_event('AGENT_ACTION_REVIEW', {'entity':entity_name,'action':action_report,'decision':result})
        return result

    def process_intent(self, user_text: str) -> Dict[str, Any]:
        text = (user_text or '').strip().lower()
        if not text: intent = 'EMPTY'
        elif any(w in text for w in ('file','ফাইল','storage','folder','ফোল্ডার')): intent = 'STORAGE'
        elif any(w in text for w in ('voice','কণ্ঠ','কথা','শুন')): intent = 'VOICE'
        elif any(w in text for w in ('tool','টুল')): intent = 'TOOL'
        else: intent = 'GENERAL'
        result = {'status':'SUCCESS','intent':intent,'intent_clarity':'DETERMINISTIC','routed_to':intent.lower()}
        self.memory_ledger.record_event('INTENT_ROUTED', {'input':user_text, **result})
        return result

    def system_status(self) -> str:
        return f'{self.system_name} is active with {len(self.active_entities)} registered foundation entities.'
