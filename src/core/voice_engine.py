"""
Mosharrof AI: Multi-Speaker Voice Diarization & Social Memory Engine
আশপাশের একাধিক ব্যক্তির কণ্ঠস্বর শনাক্তকরণ, পূর্বের পরিচয় নির্ণয় এবং সামাজিক সম্পর্ক ট্র্যাকিং ইঞ্জিন।
"""

from typing import Dict, Any, List
from src.core.memory_ledger import MemoryLedger

class VoiceJournalEngine:
    def __init__(self, memory_ledger: MemoryLedger = None):
        self.ledger = memory_ledger or MemoryLedger()
        self.is_listening = False
        self.known_voices: Dict[str, str] = {}  # {voice_signature: name/relationship}

    def toggle_listening(self, state: bool) -> Dict[str, Any]:
        """১-ক্লিক বা ভয়েস কমান্ডে অডিও ট্র্যাকিং অন/অফ করা"""
        self.is_listening = state
        status_text = "ACTIVE" if state else "INACTIVE"
        return {
            "listening_state": status_text,
            "message": f"বহু-কণ্ঠস্বর ট্র্যাকিং ও পরিবেশ পর্যবেক্ষণ এখন {'সক্রিয় (ACTIVE)' if state else 'নিষ্ক্রিয় (INACTIVE)'}।"
        }

    def identify_speaker(self, voice_signature: str) -> Dict[str, Any]:
        """
        কণ্ঠচ্ছাপ থেকে শামীম, শাহীন, নাদিমদের পূর্বের পরিচয় বের করা অথবা নতুন চিহ্নিত করা
        """
        if voice_signature in self.known_voices:
            speaker_name = self.known_voices[voice_signature]
            return {
                "is_known": True,
                "speaker": speaker_name,
                "status_message": f"পূর্ব পরিচিত ব্যক্তি চিহ্নিত: {speaker_name}"
            }
        else:
            return {
                "is_known": False,
                "speaker": "UNKNOWN_VOICE",
                "status_message": "নতুন কণ্ঠস্বর চিহ্নিত হয়েছে। মোশারফ স্মৃতিকোষে প্রোফাইল তৈরি করছে..."
            }

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        """
        আশপাশের মানুষদের কথামালা বিশ্লেষণ ও সামাজিক সম্পর্কের তথ্য সেভ করা
        """
        if not self.is_listening:
            return {"status": "DENIED", "reason": "VOICE_CAPTURE_INACTIVE"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "কোনো বাক্য ধরা পড়েনি।"}

        speaker_info = self.identify_speaker(speaker_signature)
        speaker_id = speaker_info["speaker"]

        interaction_data = {
            "speaker": speaker_id,
            "transcript": transcript,
            "is_known_person": speaker_info["is_known"],
            "privacy_status": "ENCRYPTED_LOCAL"
        }

        # সোশ্যাল স্মৃতিকোষে কথোপকথন রেকর্ড করা
        self.ledger.record_event("SOCIAL_INTERACTION_LOGGED", interaction_data)

        return {
            "status": "SUCCESS",
            "detected_speaker": speaker_id,
            "is_known": speaker_info["is_known"],
            "insight": f"{speaker_id}-এর বক্তব্য সামাজিক মেমোরিতে সংরক্ষণ করা হয়েছে।"
        }
