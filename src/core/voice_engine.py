"""Voice journal engine with explicit listening-state gating."""
from typing import Dict,Any
from src.core.memory_ledger import MemoryLedger

class VoiceJournalEngine:
    def __init__(self,memory_ledger:MemoryLedger=None):
        self.ledger=memory_ledger or MemoryLedger()
        self.is_listening=False
        self.known_voices:Dict[str,str]={}

    def toggle_listening(self,state:bool)->Dict[str,Any]:
        self.is_listening=bool(state)
        return {"listening_state":"ACTIVE" if self.is_listening else "INACTIVE",
                "message":"Voice capture active." if self.is_listening else "Voice capture inactive."}

    def identify_speaker(self,voice_signature:str)->Dict[str,Any]:
        if voice_signature in self.known_voices:
            return {"is_known":True,"speaker":self.known_voices[voice_signature],"status_message":"Known speaker identified."}
        return {"is_known":False,"speaker":"UNKNOWN_VOICE","status_message":"Unknown speaker."}

    def process_ambient_conversation(self,speaker_signature:str,transcript:str)->Dict[str,Any]:
        if not self.is_listening:
            return {"status":"DENIED","reason":"VOICE_CAPTURE_INACTIVE"}
        if not transcript.strip():
            return {"status":"EMPTY","message":"No transcript captured."}
        speaker_info=self.identify_speaker(speaker_signature)
        data={"speaker":speaker_info["speaker"],"transcript":transcript,
              "is_known_person":speaker_info["is_known"],"privacy_status":"ENCRYPTED_LOCAL"}
        self.ledger.record_event("SOCIAL_INTERACTION_LOGGED",data)
        return {"status":"SUCCESS","detected_speaker":speaker_info["speaker"],"is_known":speaker_info["is_known"]}
