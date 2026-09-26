"""Context-aware smart voice processing boundary for Mosharrof.

The engine separates speech authorization, transcript normalization, smart punctuation,
high-confidence contextual correction, phonetic/text sanitization, and audit recording.
Actual audio-to-text is provider-dependent; the core remains model-agnostic.
"""
import re
from typing import Any, Dict, Optional
from src.core.memory_ledger import MemoryLedger

class VoiceJournalEngine:
    def __init__(self, memory_ledger: Optional[MemoryLedger] = None):
        self.ledger = memory_ledger or MemoryLedger()
        self.is_listening = False
        self.recording_authorized = False
        self.known_voices: Dict[str, str] = {}

    def toggle_listening(self, state: bool, authorized: bool = False) -> Dict[str, Any]:
        if state and not authorized:
            self.is_listening = False
            self.recording_authorized = False
            return {"listening_state":"BLOCKED","recording_authorized":False,"reason":"EXPLICIT_AUTHORIZATION_REQUIRED"}
        self.is_listening = state
        self.recording_authorized = state and authorized
        return {"listening_state":"ACTIVE" if self.is_listening else "INACTIVE","recording_authorized":self.recording_authorized}

    def identify_speaker(self, voice_signature: str) -> Dict[str, Any]:
        if voice_signature in self.known_voices:
            return {"is_known":True,"speaker":self.known_voices[voice_signature]}
        return {"is_known":False,"speaker":"UNKNOWN_VOICE"}

    @staticmethod
    def apply_smart_punctuation(raw_text: str) -> str:
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        text = re.sub(r"\s+([,।!?])", r"\1", text)
        text = re.sub(r"([,!?])(?=\S)", r"\1 ", text)
        text = re.sub(r"।{2,}", "।", text)
        if text.endswith(("?", "!", "।", ".")):
            return text
        interrogative = ("কি","কী","কেন","কখন","কোথায়","কোথায়","কীভাবে","কিভাবে","কে","কার","কোন","কত")
        if any(text.endswith(word) for word in interrogative):
            return text + "?"
        return text + "।"

    @staticmethod
    def correct_contextual_grammar(raw_text: str, context: str = "") -> Dict[str, Any]:
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        replacements = {
            "কেমন আছেন আপনি": "আপনি কেমন আছেন",
            "আমি যাবে": "আমি যাব",
            "আমি যাবো": "আমি যাব",
            "আমরা যাবে": "আমরা যাব",
            "সে যাবে না কি": "সে যাবে কি না",
        }
        corrected = text
        changes = []
        for source, target in replacements.items():
            if source in corrected:
                corrected = corrected.replace(source, target)
                changes.append({"from":source,"to":target,"confidence":"HIGH"})
        return {"text":corrected,"changed":corrected != text,"changes":changes,"context_used":bool((context or "").strip())}

    @classmethod
    def sanitize_phonetic_speech(cls, audio_stream: Any, transcript: Optional[str] = None, context: str = "") -> Dict[str, Any]:
        if transcript is None:
            if isinstance(audio_stream, str):
                transcript = audio_stream
            else:
                return {"status":"TRANSCRIBER_REQUIRED","reason":"A speech-to-text provider must supply transcript text."}
        corrected = cls.correct_contextual_grammar(transcript, context=context)
        punctuated = cls.apply_smart_punctuation(corrected["text"])
        return {"status":"SUCCESS","text":punctuated,"corrections":corrected["changes"],"changed":corrected["changed"] or punctuated != transcript.strip()}

    def process_ambient_conversation(self, speaker_signature: str, transcript: str, context: str = "") -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status":"BLOCKED","reason":"RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status":"EMPTY","message":"No transcript supplied."}
        smart = self.sanitize_phonetic_speech(transcript, transcript=transcript, context=context)
        speaker_info = self.identify_speaker(speaker_signature)
        self.ledger.record_event("SOCIAL_INTERACTION_LOGGED", {
            "speaker":speaker_info["speaker"],"transcript":smart["text"],"corrections":smart["corrections"],
            "is_known_person":speaker_info["is_known"],"privacy_status":"LOCAL_ONLY"})
        return {"status":"SUCCESS","detected_speaker":speaker_info["speaker"],"is_known":speaker_info["is_known"],
                "text":smart["text"],"corrections":smart["corrections"]}
