"""Context-aware Mosharrof voice processing with explicit authorization.

Speech-to-text is an external boundary. This engine provides conservative
transcript cleanup, contextual correction and smart punctuation.
"""
import re
from typing import Any, Dict, Iterable, Optional, Sequence, Callable
from src.core.memory_ledger import MemoryLedger

class VoiceJournalEngine:
    DEFAULT_CORRECTIONS = {
        "গবেষনা":"গবেষণা","প্রজেকট":"প্রজেক্ট","খুজে":"খুঁজে","খুজুন":"খুঁজুন",
        "কোরান":"কুরআন","কুরান":"কুরআন","মোশারফ এর":"মোশাররফের",
        "মোশাররফ এর":"মোশাররফের","কুরআন গবেষনা":"কুরআন গবেষণা",
        "মোশারফ":"মোশাররফ","মোশররফ":"মোশারফ","মশারফ":"মোশাররফ",
        "মোশরফ":"মোশাররফ","করতেছ":"করছ","করতেছেন":"করছেন",
        "করতেছি":"করছি","দিতেছি":"দিচ্ছি","যাইতেছি":"যাচ্ছি","আসতেছি":"আসছি",
    }
    def __init__(self,memory_ledger:Optional[MemoryLedger]=None,
                 correction_map:Optional[Dict[str,str]]=None,
                 transcription_provider:Optional[Callable[[Any],str]]=None):
        self.ledger=memory_ledger or MemoryLedger()
        self.is_listening=False
        self.recording_authorized=False
        self.known_voices:Dict[str,str]={}
        self.correction_map=dict(self.DEFAULT_CORRECTIONS)
        if correction_map: self.correction_map.update(correction_map)
        self.transcription_provider=transcription_provider

    def toggle_listening(self,state:bool,authorized:bool=False)->Dict[str,Any]:
        if state and not authorized:
            self.is_listening=False; self.recording_authorized=False
            return {"listening_state":"BLOCKED","recording_authorized":False,"reason":"EXPLICIT_AUTHORIZATION_REQUIRED"}
        self.is_listening=state; self.recording_authorized=state and authorized
        return {"listening_state":"ACTIVE" if self.is_listening else "INACTIVE","recording_authorized":self.recording_authorized}

    def identify_speaker(self,voice_signature:str)->Dict[str,Any]:
        if voice_signature in self.known_voices:return {"is_known":True,"speaker":self.known_voices[voice_signature]}
        return {"is_known":False,"speaker":"UNKNOWN_VOICE"}

    @staticmethod
    def _clean_spacing(text:str)->str:
        text=re.sub(r"[ \t]+"," ",text.strip())
        return re.sub(r"\s+([,।?!])",r"\1",text)

    def apply_smart_punctuation(self,raw_text:str,pause_boundaries:Optional[Sequence[int]]=None,
                                question_hint:Optional[bool]=None)->str:
        text=self._clean_spacing(raw_text or "")
        if not text:return ""
        text=re.sub(r"\s*\[pause\]\s*","। ",text,flags=re.IGNORECASE)
        if pause_boundaries:
            for offset in sorted(pause_boundaries,reverse=True):
                if 0<offset<len(text): text=text[:offset].rstrip()+", "+text[offset:].lstrip()
        if not re.search(r"[?!।]$",text):
            q=("কি ","কী ","কেন ","কীভাবে ","কিভাবে ","কোথায় ","কোথায় ","কখন ","কে ","কোন ","কত ")
            inferred=text.startswith(q) or text.endswith((" কি"," কেন"," কীভাবে"," কিভাবে"))
            text += "?" if question_hint is True or inferred else "।"
        text=re.sub(r"।{2,}","।",text); text=re.sub(r"\?+","?",text)
        text=re.sub(r"^(আচ্ছা|তাহলে|তবে|অর্থাৎ|প্রথমে|এরপর|এখন|কিন্তু)\s+",r"\1, ",text)
        return text

    def correct_contextual_grammar(self,raw_text:str,context:Optional[Iterable[str]]=None)->str:
        text=self._clean_spacing(raw_text or "")
        if not text:return ""
        for source,target in sorted(self.correction_map.items(),key=lambda item:-len(item[0])):
            text=re.sub(rf"(?<!\S){re.escape(source)}(?!\S)",target,text)
        return text

    def sanitize_phonetic_speech(self,audio_stream:Any,*,transcript:Optional[str]=None,
                                 context:Optional[Iterable[str]]=None)->Dict[str,Any]:
        if not self.recording_authorized:return {"status":"BLOCKED","reason":"RECORDING_NOT_AUTHORIZED"}
        if transcript is None:
            if isinstance(audio_stream,str): transcript=audio_stream
            elif self.transcription_provider is not None: transcript=self.transcription_provider(audio_stream)
            else:return {"status":"UNAVAILABLE","reason":"SPEECH_RECOGNITION_ADAPTER_REQUIRED"}
        if not isinstance(transcript,str) or not transcript.strip():return {"status":"EMPTY","reason":"NO_TRANSCRIPT"}
        corrected=self.correct_contextual_grammar(transcript,context=context)
        final=self.apply_smart_punctuation(corrected)
        self.ledger.record_event("VOICE_TRANSCRIPT_PROCESSED",{"raw_text":transcript,"corrected_text":corrected,"final_text":final})
        return {"status":"SUCCESS","raw_text":transcript,"corrected_text":corrected,"sanitized_text":final,"text":final,"stt_provider":"EXTERNAL_BOUNDARY"}

    def process_voice_text(self,transcript:str,*,context:Optional[Iterable[str]]=None)->Dict[str,Any]:
        corrected=self.correct_contextual_grammar(transcript,context=context)
        final=self.apply_smart_punctuation(corrected)
        return {"status":"SUCCESS" if final else "EMPTY","corrected_text":corrected,"final_text":final}

    def process_voice_transcript(self,transcript:str,*,context:Optional[Iterable[str]]=None)->Dict[str,Any]:
        return self.process_voice_text(transcript,context=context)

    def process_transcript(self,raw_text:str)->Dict[str,Any]:
        result=self.process_voice_text(raw_text)
        result.update({"raw_text":raw_text or "","sanitized_text":result.get("final_text","")})
        if result["status"]=="SUCCESS": self.ledger.record_event("VOICE_TRANSCRIPT_PROCESSED",result)
        return result

    def process_ambient_conversation(self,speaker_signature:str,transcript:str)->Dict[str,Any]:
        if not self.recording_authorized:return {"status":"BLOCKED","reason":"RECORDING_NOT_AUTHORIZED"}
        if not transcript.strip():return {"status":"EMPTY","message":"No transcript supplied."}
        processed=self.process_voice_text(transcript); speaker=self.identify_speaker(speaker_signature)
        self.ledger.record_event("SOCIAL_INTERACTION_LOGGED",{"speaker":speaker["speaker"],"transcript":processed["final_text"],
            "raw_transcript":transcript,"is_known_person":speaker["is_known"],"privacy_status":"LOCAL_ONLY","voice_processing":"CONTEXT_AWARE"})
        return {"status":"SUCCESS","detected_speaker":speaker["speaker"],"is_known":speaker["is_known"],"transcript":processed["final_text"]}
