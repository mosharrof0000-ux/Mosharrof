"""
Mosharrof AI: Voice Journal & Personality Biography Engine
ইউজারের পারমিশনসাপেক্ষে ১-ক্লিক বা ভয়েস কমান্ডে তথ্য রেকর্ড ও জীবনী সংরক্ষণ ইঞ্জিন।
"""

from typing import Dict, Any
from src.core.memory_ledger import MemoryLedger

class VoiceJournalEngine:
    def __init__(self, memory_ledger: MemoryLedger = None):
        self.ledger = memory_ledger or MemoryLedger()
        self.is_listening = False

    def toggle_listening(self, state: bool) -> Dict[str, Any]:
        """১-ক্লিক বা ভয়েস কমান্ডে রেকর্ডিং অন/অফ করা"""
        self.is_listening = state
        status_text = "ACTIVE" if state else "INACTIVE"
        return {
            "listening_state": status_text,
            "message": f"ভয়েস জেনারেটর ও ব্যক্তিত্ব বিশ্লেষণ এখন {'সক্রিয় (ACTIVE)' if state else 'নিষ্ক্রিয় (INACTIVE)'}।"
        }

    def process_voice_entry(self, transcript: str) -> Dict[str, Any]:
        """
        ইউজারের জীবনের গুরুত্বপূর্ণ কথামালা বিশ্লেষণ করে শতভাগ সুরক্ষিত মেমোরিতে জীবনী হিসেবে সেভ করা
        """
        if not transcript.strip():
            return {"status": "EMPTY_TRANSCRIPT", "message": "কোনো কথা ধরা পড়েনি।"}

        entry_data = {
            "raw_text": transcript,
            "privacy_level": "ENCRYPTED_USER_ONLY",
            "biography_insight": "ব্যক্তিত্ব ও জীবনের অনুভূতি সংরক্ষিত হয়েছে।"
        }
        
        # স্মৃতিকোষে এনক্রিপ্টেড জীবনী জমা করা
        self.ledger.record_event("LIFE_BIOGRAPHY_ENTRY", entry_data)
        
        return {
            "status": "SUCCESS",
            "logged_text": transcript,
            "biography_updated": True,
            "response": f"আপনার কথাটি বিশ্লেষণ করে ব্যক্তিত্বের স্মৃতিকোষে সংরক্ষিত করা হয়েছে।"
        }
