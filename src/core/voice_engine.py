"""Mosharrof context-aware voice journal engine.

The engine keeps the recording/consent boundary explicit while providing
deterministic text post-processing hooks for smart punctuation, contextual
correction and phonetic normalization. Acoustic features such as pause and
intonation are represented as optional metadata and are not fabricated.
"""

from typing import Any, Dict, Mapping, Optional
import re

from src.core.memory_ledger import MemoryLedger


class VoiceJournalEngine:
    """Voice input boundary plus context-aware transcript processing."""

    DEFAULT_CONTEXT_CORRECTIONS = {
        "মশারফ": "মোশাররফ",
        "মোশরফ": "মোশাররফ",
        "কোরান": "কুরআন",
        "কুরান": "কুরআন",
    }

    def __init__(self, memory_ledger: Optional[MemoryLedger] = None):
        self.ledger = memory_ledger or MemoryLedger()
        self.is_listening = False
        self.recording_authorized = False
        self.known_voices: Dict[str, str] = {}

    def toggle_listening(self, state: bool, authorized: bool = False) -> Dict[str, Any]:
        if state and not authorized:
            self.is_listening = False
            self.recording_authorized = False
            return {"listening_state": "BLOCKED", "recording_authorized": False,
                    "reason": "EXPLICIT_AUTHORIZATION_REQUIRED"}
        self.is_listening = state
        self.recording_authorized = state and authorized
        return {"listening_state": "ACTIVE" if self.is_listening else "INACTIVE",
                "recording_authorized": self.recording_authorized}

    def identify_speaker(self, voice_signature: str) -> Dict[str, Any]:
        if voice_signature in self.known_voices:
            return {"is_known": True, "speaker": self.known_voices[voice_signature]}
        return {"is_known": False, "speaker": "UNKNOWN_VOICE"}

    @staticmethod
    def apply_smart_punctuation(
        raw_text: str,
        *,
        pause_marks: Optional[Mapping[int, str]] = None,
        question_hint: Optional[bool] = None,
    ) -> str:
        """Normalize transcript punctuation without inventing audio cues."""
        text = re.sub(r"\s+", " ", (raw_text or "").strip())
        if not text:
            return ""

        text = re.sub(r"\s+([,।?!])", r"\1", text)
        text = re.sub(r"([,।?!])(?=\S)", r"\1 ", text).strip()

        if pause_marks:
            for offset, mark in sorted(pause_marks.items(), reverse=True):
                if mark not in {",", "।", "?", "!"}:
                    continue
                if 0 < offset <= len(text):
                    left, right = text[:offset].rstrip(), text[offset:].lstrip()
                    text = f"{left}{mark} {right}".strip()

        if question_hint and text and text[-1] not in "।?!":
            text += "?"
        elif text and text[-1] not in "।?!,":
            text += "।"
        return text

    def correct_contextual_grammar(
        self,
        raw_text: str,
        *,
        context: Optional[str] = None,
        corrections: Optional[Mapping[str, str]] = None,
    ) -> str:
        """Apply only explicit, deterministic contextual corrections."""
        text = (raw_text or "").strip()
        mapping = dict(self.DEFAULT_CONTEXT_CORRECTIONS)
        if corrections:
            mapping.update(corrections)

        for source, target in sorted(mapping.items(), key=lambda item: -len(item[0])):
            text = text.replace(source, target)

        if context and "কুরআন" in context and "কোরআন" in text:
            text = text.replace("কোরআন", "কুরআন")
        return text

    @staticmethod
    def sanitize_phonetic_speech(audio_stream: Any) -> Dict[str, Any]:
        """Normalize an upstream transcript/ASR result.

        Audio decoding belongs to the speech-recognition adapter. If text is
        supplied, common Unicode/whitespace noise is cleaned without claiming
        acoustic interpretation that was not actually performed.
        """
        if isinstance(audio_stream, str):
            normalized = re.sub(r"\s+", " ", audio_stream).strip()
            return {"status": "SUCCESS", "input_type": "TRANSCRIPT", "text": normalized}
        if isinstance(audio_stream, Mapping):
            transcript = audio_stream.get("transcript")
            if isinstance(transcript, str):
                normalized = re.sub(r"\s+", " ", transcript).strip()
                return {"status": "SUCCESS", "input_type": "ASR_RESULT",
                        "text": normalized, "metadata": dict(audio_stream.get("metadata") or {})}
        return {"status": "DEFERRED", "reason": "SPEECH_RECOGNITION_ADAPTER_REQUIRED"}

    def process_transcript(
        self,
        raw_text: str,
        *,
        context: Optional[str] = None,
        pause_marks: Optional[Mapping[int, str]] = None,
        question_hint: Optional[bool] = None,
        corrections: Optional[Mapping[str, str]] = None,
    ) -> Dict[str, Any]:
        """Run phonetic normalization, contextual correction and punctuation."""
        sanitized = self.sanitize_phonetic_speech(raw_text)
        if sanitized["status"] != "SUCCESS":
            return sanitized
        corrected = self.correct_contextual_grammar(
            sanitized["text"], context=context, corrections=corrections
        )
        punctuated = self.apply_smart_punctuation(
            corrected, pause_marks=pause_marks, question_hint=question_hint
        )
        self.ledger.record_event("VOICE_TRANSCRIPT_PROCESSED", {
            "input": sanitized["text"], "output": punctuated, "context_used": bool(context)
        })
        return {
            "status": "SUCCESS",
            "text": punctuated,
            "stages": ["phonetic_sanitizer", "contextual_correction", "smart_punctuation"],
        }

    def process_ambient_conversation(self, speaker_signature: str, transcript: str) -> Dict[str, Any]:
        if not self.recording_authorized:
            return {"status": "BLOCKED", "reason": "RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():
            return {"status": "EMPTY", "message": "No transcript supplied."}
        speaker_info = self.identify_speaker(speaker_signature)
        processed = self.process_transcript(transcript)
        self.ledger.record_event("SOCIAL_INTERACTION_LOGGED", {
            "speaker": speaker_info["speaker"],
            "transcript": processed.get("text", transcript),
            "is_known_person": speaker_info["is_known"],
            "privacy_status": "LOCAL_ONLY",
        })
        return {"status": "SUCCESS", "detected_speaker": speaker_info["speaker"],
                "is_known": speaker_info["is_known"],
                "transcript": processed.get("text", transcript)}
