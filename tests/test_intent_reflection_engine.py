from src.core.intent_reflection_engine import IntentReflectionEngine


def test_prepare_reflects_explicit_goal_without_claiming_to_read_mind():
    engine = IntentReflectionEngine()
    plan = engine.prepare("আমার কাজটা বাস্তবে সম্পন্ন করে পরীক্ষা করুন")
    assert "বাস্তবে" in plan["user_goal"]
    assert plan["confidence"] >= 0.65
    assert "নিশ্চিত সিদ্ধান্ত নয়" in plan["affect_signal"] or plan["affect_signal"] == "স্পষ্ট আবেগের সংকেত নেই"
    assert plan["private_reasoning_disclosed"] is False


def test_possible_emotional_need_is_tentative_not_a_diagnosis():
    plan = IntentReflectionEngine().prepare("বারবার সমস্যা হচ্ছে, আমি বিরক্ত")
    assert "সম্ভাব্য" in plan["affect_signal"]
    assert "সমাধান" in plan["possible_need"]
    assert any("অনুমানকে নিশ্চিত সত্য বলা নয়" in item for item in plan["constraints_to_respect"])


def test_ambiguous_short_request_triggers_clarification():
    plan = IntentReflectionEngine().prepare("এটা")
    assert plan["confidence"] < 0.65
    assert plan["clarification_question"]
    assert plan["action_requires_confirmation"] is True


def test_sensitive_action_requests_confirmation():
    plan = IntentReflectionEngine().prepare("আমার হয়ে মেসেজ পাঠিয়ে দাও")
    assert plan["action_requires_confirmation"] is True
    assert plan["clarification_question"]
    assert "অনুমোদন" in plan["response_strategy"]


def test_review_flags_empty_and_mind_reading_claims():
    engine = IntentReflectionEngine()
    assert "EMPTY_RESPONSE" in engine.review("হ্যালো", "")["issues"]
    review = engine.review("আমি কেমন আছি?", "আমি আপনার মন পড়তে পারি এবং সব জানি।")
    assert review["ready"] is False
    assert "UNSUPPORTED_MIND_READING_CLAIM" in review["issues"]


def test_context_can_increase_confidence_but_never_exposes_private_reasoning():
    plan = IntentReflectionEngine().prepare("আমার রুটিন বুঝুন", context={"routine": "morning"})
    assert plan["confidence"] >= 0.65
    assert plan["private_reasoning_disclosed"] is False
