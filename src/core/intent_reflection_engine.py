"""Reflective intent planning for concise, careful, user-centered responses.

This deterministic layer does not expose private chain-of-thought or claim to
read minds. It produces a brief, auditable response plan from the user's words,
marks emotional interpretations as tentative, and asks for clarification when
intent is uncertain. A language model may use the plan to compose the answer.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, asdict
from typing import Dict, List, Optional


@dataclass(frozen=True)
class ReflectionPlan:
    user_goal: str
    explicit_request: str
    possible_need: str
    affect_signal: str
    confidence: float
    constraints_to_respect: List[str]
    response_strategy: str
    clarification_question: Optional[str]
    action_requires_confirmation: bool
    private_reasoning_disclosed: bool = False


class IntentReflectionEngine:
    """Builds a user-facing-safe plan before responding and checks answers after."""

    _URGENT = ("জরুরি", "এখনই", "তাড়াতাড়ি", "দ্রুত", "urgent", "right now", "quickly")
    _FRUSTRATED = ("হচ্ছে না", "বারবার", "বিরক্ত", "রাগ", "সমস্যা", "ব্যর্থ", "frustrated", "doesn't work", "failed")
    _CONFUSED = ("বুঝতে পারছি না", "বুঝলাম না", "ক্লিয়ার না", "কীভাবে", "কিভাবে", "confused", "don't understand")
    _SAFETY = ("delete", "মুছে", "পেমেন্ট", "pay", "পাঠিয়ে দাও", "send", "শেয়ার", "share", "post", "install", "কিনে", "buy")

    def __init__(self, *, confidence_threshold: float = 0.65):
        if not 0.0 <= confidence_threshold <= 1.0:
            raise ValueError("confidence_threshold must be between 0 and 1")
        self.confidence_threshold = confidence_threshold

    @staticmethod
    def _clean(text: str) -> str:
        return re.sub(r"\s+", " ", text).strip()

    def prepare(self, user_text: str, *, context: Optional[Dict[str, str]] = None) -> Dict[str, object]:
        """Create a compact response plan; never execute an action."""
        utterance = self._clean(user_text or "")
        if not utterance:
            plan = ReflectionPlan(
                user_goal="নির্ধারণ করা যায়নি",
                explicit_request="কোনো বার্তা দেওয়া হয়নি",
                possible_need="ব্যবহারকারী কী চান তা জানতে হবে",
                affect_signal="অনুমান করা হয়নি",
                confidence=0.0,
                constraints_to_respect=["অনুমানকে সত্য হিসেবে উপস্থাপন নয়"],
                response_strategy="একটি সহজ, খোলামেলা প্রশ্ন করুন",
                clarification_question="আপনি কী করতে চান বা কী নিয়ে কথা বলতে চান?",
                action_requires_confirmation=True,
            )
            return asdict(plan)

        lower = utterance.lower()
        affect = "স্পষ্ট আবেগের সংকেত নেই"
        if any(word in lower for word in self._URGENT):
            affect = "তাড়াহুড়োর ভাষার সংকেত; কারণ নিশ্চিত নয়"
        elif any(word in lower for word in self._FRUSTRATED):
            affect = "সমস্যা বা হতাশার সম্ভাব্য ভাষাগত সংকেত; নিশ্চিত সিদ্ধান্ত নয়"
        elif any(word in lower for word in self._CONFUSED):
            affect = "বোঝার অসুবিধার সম্ভাব্য ভাষাগত সংকেত; নিশ্চিত সিদ্ধান্ত নয়"

        action_words = any(word in lower for word in self._SAFETY)
        context_available = bool(context)
        confidence = 0.78 if len(utterance) >= 12 else 0.55
        if utterance.endswith("?") or "কী" in utterance or "কেন" in utterance or "how" in lower or "why" in lower:
            confidence = min(0.92, confidence + 0.08)
        if action_words:
            confidence = min(confidence, 0.68)
        if context_available:
            confidence = min(0.95, confidence + 0.04)

        goal = utterance
        if len(goal) > 180:
            goal = goal[:177].rstrip() + "..."
        needs = {
            "তাড়াহুড়োর ভাষার সংকেত; কারণ নিশ্চিত নয়": "দ্রুত, সরাসরি পরবর্তী পদক্ষেপ",
            "সমস্যা বা হতাশার সম্ভাব্য ভাষাগত সংকেত; নিশ্চিত সিদ্ধান্ত নয়": "সমস্যার স্বীকৃতি ও যাচাইযোগ্য সমাধান",
            "বোঝার অসুবিধার সম্ভাব্য ভাষাগত সংকেত; নিশ্চিত সিদ্ধান্ত নয়": "সহজ ভাষায় ব্যাখ্যা এবং প্রয়োজনে একটি প্রশ্ন",
            "স্পষ্ট আবেগের সংকেত নেই": "উদ্দেশ্য অনুযায়ী উপযোগী উত্তর",
        }[affect]
        clarification = None
        strategy = "প্রথমে উদ্দেশ্য ও সীমাবদ্ধতা মিলিয়ে সংক্ষিপ্ত, সরাসরি উত্তর দিন"
        if confidence < self.confidence_threshold:
            strategy = "অনুমান না করে একটি প্রয়োজনীয় স্পষ্টীকরণ প্রশ্ন করুন"
            clarification = "আপনি কি চান আমি বিষয়টি ব্যাখ্যা করি, পরিকল্পনা করি, নাকি বাস্তবে কোনো কাজ সম্পাদন করি?"
        if action_words:
            strategy = "কাজের লক্ষ্য ও প্রভাব যাচাই করুন; সংবেদনশীল বা বাহ্যিক প্রভাবের কাজ হলে অনুমোদন নিন"
            clarification = clarification or "এই কাজটি করার আগে আপনি কি নিশ্চিত করছেন?"
        plan = ReflectionPlan(
            user_goal=goal,
            explicit_request=utterance,
            possible_need=needs,
            affect_signal=affect,
            confidence=round(confidence, 2),
            constraints_to_respect=[
                "অনুভূতি বা উদ্দেশ্য সম্পর্কে অনুমানকে নিশ্চিত সত্য বলা নয়",
                "ব্যক্তিগত/সংবেদনশীল তথ্য অকারণে সংগ্রহ নয়",
                "বাস্তব কাজের ফলাফল যাচাই ছাড়া সফল দাবি নয়",
                "প্রয়োজনীয় অনুমোদন ছাড়া বাহ্যিক প্রভাবযুক্ত কাজ নয়",
            ],
            response_strategy=strategy,
            clarification_question=clarification,
            action_requires_confirmation=bool(action_words) or confidence < self.confidence_threshold,
        )
        return asdict(plan)

    def review(self, user_text: str, draft_response: str) -> Dict[str, object]:
        """Check a draft for alignment, overclaiming, and missing next steps."""
        request = self._clean(user_text or "")
        draft = self._clean(draft_response or "")
        issues: List[str] = []
        if not draft:
            issues.append("EMPTY_RESPONSE")
        if any(term in draft.lower() for term in ("i read your mind", "আমি আপনার মন পড়তে পারি", "আমি নিশ্চিত জানি আপনি অনুভব করছেন")):
            issues.append("UNSUPPORTED_MIND_READING_CLAIM")
        if request and draft and len(draft) < 12:
            issues.append("POSSIBLY_TOO_BRIEF")
        return {
            "ready": len(issues) == 0,
            "issues": issues,
            "request_present": bool(request),
            "draft_present": bool(draft),
            "private_reasoning_disclosed": False,
            "recommendation": "উত্তর দিন" if not issues else "সমস্যাগুলো ঠিক করে উত্তর পুনরায় যাচাই করুন",
        }
