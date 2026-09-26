"""
Mosharrof AI Ecosystem Complete Integration Test
সকল মডিউল (Tool Factory, Voice Engine, Storage Engine, Brain) যৌথভাবে পরীক্ষা করা।
"""

import pytest
from src.core.mosharrof_brain import MosharrofCoreBrain
from src.core.event_bus import EcosystemEventBus
from src.core.memory_ledger import MemoryLedger
from src.core.tool_factory import ToolFactory
from src.core.voice_engine import VoiceJournalEngine
from src.core.storage_engine import StorageEngine

def test_full_ecosystem_flow():
    # ১. ইভেন্ট বাস ও মেমোরি লেজার তৈরি
    event_bus = EcosystemEventBus()
    ledger = MemoryLedger()
    
    # ২. ব্রেন ও সাব-ইঞ্জিন ইনস্ট্যানশিয়েশন
    brain = MosharrofCoreBrain(event_bus=event_bus, memory_ledger=ledger)
    tool_factory = ToolFactory()
    voice_engine = VoiceJournalEngine(memory_ledger=ledger)
    storage_engine = StorageEngine()

    # ৩. ভয়েস ও ব্যক্তিত্ব ট্র্যাকিং টেস্ট
    voice_toggle = voice_engine.toggle_listening(True)
    assert voice_toggle["listening_state"] == "ACTIVE"

    voice_res = voice_engine.process_ambient_conversation("SPEAKER_SHAMIM_01", "আজকের মিটিংয়ের সিদ্ধান্ত কী?")
    assert voice_res["status"] == "SUCCESS"

    # ৪. স্টোরেজ ও ফাইল ইনডেক্সিং টেস্ট
    scan_res = storage_engine.scan_and_index_storage(".")
    assert scan_res["status"] == "SUCCESS"

    # ৫. টুল ফ্যাক্টরি টেস্ট
    available_tools = tool_factory.list_available_tools()
    assert isinstance(available_tools, list)

    # ৬. কোর ব্রেন প্রসেসিং টেস্ট
    brain_res = brain.process_intent("আমাদের জীবনের গল্প ও ফাইল গুছিয়ে রাখো")
    assert brain_res["status"] == "SUCCESS"
    assert brain_res["intent_clarity"] == "100%"
