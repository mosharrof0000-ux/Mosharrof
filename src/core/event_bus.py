"""
Mosharrof AI: Autonomous Event Bus (ইকোসিস্টেমের অভ্যন্তরীণ স্নায়ুতন্ত্র)
সাব-এজেন্ট, মাস্টার ব্রেইন এবং ইউআই অর্গানের মধ্যে ক্র্যাশ-মুক্ত বার্তা প্রচার করে।
"""

from typing import Dict, Any, List, Callable

class EcosystemEventBus:
    def __init__(self):
        self.subscribers: Dict[str, List[Callable]] = {}

    def subscribe(self, event_type: str, callback: Callable):
        """কোনো নির্দিষ্ট ইভেন্টে বা সংকেতে সত্তাকে যুক্ত করা"""
        if event_type not in self.subscribers:
            self.subscribers[event_type] = []
        self.subscribers[event_type].append(callback)

    def publish(self, event_type: str, data: Dict[str, Any]):
        """সমগ্র ইকোসিস্টেমে স্বায়ত্তশাসিত বার্তা প্রচার করা"""
        print(f"[EventBus] Publishing signal '{event_type}' across ecosystem.")
        if event_type in self.subscribers:
            for callback in self.subscribers[event_type]:
                callback(data)
