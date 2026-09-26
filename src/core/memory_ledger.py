"""
Mosharrof AI: Autonomous Memory & State Ledger
সমগ্র ইকোসিস্টেমের স্বল্পমেয়াদী ও দীর্ঘমেয়াদী স্মৃতিকোষ।
"""

from typing import Dict, Any, List
import time

class MemoryLedger:
    def __init__(self):
        self.short_term_memory: List[Dict[str, Any]] = []
        self.long_term_memory: Dict[str, Any] = {}

    def record_event(self, event_type: str, payload: Dict[str, Any]):
        """ঘটনা স্বল্পমেয়াদী স্মৃতিতে সেভ করা"""
        entry = {
            "timestamp": time.time(),
            "event_type": event_type,
            "payload": payload
        }
        self.short_term_memory.append(entry)
        print(f"[MemoryLedger] Event '{event_type}' stored in short-term memory.")

    def consolidate_knowledge(self, key: str, data: Any):
        """গুরুত্বপূর্ণ অভিজ্ঞতা দীর্ঘমেয়াদী স্মৃতিতে স্থায়ী করা"""
        self.long_term_memory[key] = data
        print(f"[MemoryLedger] Knowledge '{key}' consolidated in long-term memory.")

    def recall_recent_events(self, limit: int = 5) -> List[Dict[str, Any]]:
        """সাম্প্রতিক স্মৃতি স্মরণ করা"""
        return self.short_term_memory[-limit:]
