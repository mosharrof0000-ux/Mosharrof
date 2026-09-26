"""Mosharrof Context-Aware Smart Voice Engine.

The engine keeps recording authorization explicit, then normalizes speech text with
local deterministic rules. If a model provider is attached, contextual correction
can be delegated through the model-agnostic BrainAdapter. Raw audio decoding/STT
remains outside this dependency-free core boundary.
"""

import re
from typing import Any, Dict, Optional
from src.core.memory_ledger import MemoryLedger
from src.core.brain_adapter import BrainAdapter


class VoiceJournalEngine:
    def __init__(
        self,
        memory_ledger: Optional[MemoryLedger] = None,
        brain_adapter: Optional[BrainAdapter] = None,
    ):
        self.ledger = memory_ledger or MemoryLedger()
        self.brain_adapter = brain_adapter or BrainAdapter(entity_id="voice")
        self.is_listening = False
        self.recording_authorized = False
        self.known_voices: Dict[str, str] = {}

    def toggle_listening(self, state: bool, authorized: bool = False) -> Dict[str, Any]:
        if state and not authorized:
            self.is_listening = False
            self.recording_authorized = False
            return {"listening_state": "BLOCKED", "recording_authorized": False, "reason": "EXPLICIT_AUTHORIZATION_REQUIRED"}
        self.is_listening = state
        self.recording_authorized = state and authorized
        return {"listening_state": "ACTIVE" if self.is_listening else "INACTIVE", "recording_authorized": self.recording_authorized}

    def identify_speaker(self, voice_signature: str) -> Dict[str, Any]:
        if voice_signature in self.known_voices:
            return {"is_known": True, "speaker": self.known_voices[voice_signature]}
        return {"is_known": False, "speaker": "UNKNOWN_VOICE"}

    @staticmethod
    def apply_smart_punctuation(raw_text: str) -> str:
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""
        text = re.sub(r"\s+([,।?!])", r"\1", text)
        text = re.sub(r"([,।?!])(?=[^\s])", r"\1 ", text)
        if text and not re.search(r"[।?!]$", text):
            if re.match(r"^(কি|কী|কেন|কখন|কোথায়|কোথায়|কীভাবে|কিভাবে|কত|কে|what|why|when|where|how|who|is|are|can|do|does)\b", text, re.I):
                text += "?"
            else:
                text += "।"
        return text

    @staticmethod
    def _deterministic_context_corrections(text: str, context: Optional[str] = None) -> str:
        corrections = {
            "মোশারফ প্রজেক্ট": "মোশাররফ প্রজেক্ট",
            "মোশারফ প্রজেক্টের": "মোশাররফ প্রজেক্টের",
            "মশাররফ": "মোশাররফ",
        }
        corrected = text
        for wrong, right in corrections.items():
            corrected = corrected.replace(wrong, right)
        if context:
            corrected = corrected.strip()
        return corrected

    def correct_contextual_grammar(self, raw_text: str, context: Optional[str] = None) -> Dict[str, Any]:
        text = (raw_text or "").strip()
        if not text:
            return {"status": "EMPTY", "text": "", "method": "NONE"}

        if self.brain_adapter.provider is not None:
            prompt = (
                "Correct only clear transcription/grammar errors in this Bengali speech. "
                "Preserve meaning, names, numbers and intent. Return only corrected text.\n"
                f"Context: {context or 'none'}\nText: {text}"
            )
            try:
                model_text = self.brain_adapter.generate(prompt)
                if model_text and model_text.strip():
                    return {"status": "SUCCESS", "text": model_text.strip(), "method": "MODEL_CONTEXT"}
            except Exception:
                pass

        corrected = self._deterministic_context_corrections(text, context)
        return {"status": "SUCCESS", "text": corrected, "method": "LOCAL_SAFE_RULES"}

    def sanitize_phonetic_speech(self, audio_stream: Any, context: Optional[str] = None) -> Dict[str, Any]:
        if isinstance(audio_stream, bytes):
            return {"status": "UNSUPPORTED_AUDIO", "reason": "ATTACH_SPEECH_TO_TEXT_ADAPTER", "text": ""}
        if isinstance(audio_stream, str):
            raw_text = audio_stream
        elif hasattr(audio_stream, "transcript"):
            raw_text = str(getattr(audio_stream, "transcript") or "")
        else:
            raw_text = str(audio_stream or "")

        correction = self.correct_contextual_grammar(raw_text, context=context)
        punctuated = self.apply_smart_punctuation(correction["text"])
        return {
            "status": correction["status"],
            "text": punctuated,
            "method": correction["method"],
            "audio_decoding": "EXTERNAL_STT_ADAPTER_REQUIRED",
        }

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}
        speaker_info = self.identify_speaker(speaker_signature)
        smart = self.sanitize_phonetic_speech(transcript)
        self.ledger.record_event("SOCIAL_INTERACTION_LOGGED", {
            "speaker": speaker_info["speaker"],
            "transcript": smart["text"],
            "is_known_person": speaker_info["is_known"],
            "privacy_status": "LOCAL_ONLY",
        })
        return {
            "status": "SUCCESS",
            "detected_speaker": speaker_info["speaker"],
            "is_known": speaker_info["is_known"],
            "transcript": smart["text"],
            "voice_processing": smart["method"],
        }
