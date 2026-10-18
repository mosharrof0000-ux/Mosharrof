"""Reflective response wrapper that keeps the base brain adapter small.

Builds a compact intent/uncertainty plan before generation and reviews the draft
before returning it. It never executes device actions or exposes private
chain-of-thought.
"""
from typing import Dict, Optional, Any

from src.core.brain_adapter import BrainAdapter
from src.core.intent_reflection_engine import IntentReflectionEngine


class ReflectiveBrain:
    def __init__(
        self,
        brain: BrainAdapter,
        reflection_engine: Optional[IntentReflectionEngine] = None,
    ):
        self.brain = brain
        self.reflection_engine = reflection_engine or IntentReflectionEngine()
        self.last_plan: Optional[Dict[str, object]] = None
        self.last_review: Optional[Dict[str, object]] = None

    def generate(self, user_text: str, *, context: Optional[Dict[str, str]] = None, **kwargs: Any) -> str:
        """Prepare, answer, review, and retry once when the review finds a defect."""
        plan = self.reflection_engine.prepare(user_text, context=context)
        self.last_plan = plan
        prompt = (
            "Answer the user's request in their language. Use this compact response "
            "plan to consider the explicit goal, possible need, uncertainty, and constraints. "
            "Treat emotional cues as tentative, never claim to read minds, and ask the "
            "clarification question if needed. Do not reveal private chain-of-thought; "
            "provide only the answer and a brief rationale when useful. Never claim an "
            "action succeeded without evidence.\n\n"
            f"Response plan: {plan}\n\nUser message: {user_text}"
        )
        draft = self.brain.generate(prompt, **kwargs)
        review = self.reflection_engine.review(user_text, draft)
        if not review["ready"]:
            draft = self.brain.generate(
                f"{prompt}\n\nReview findings: {review['issues']}. "
                "Revise the answer to resolve these issues. Return only the revised answer.",
                **kwargs,
            )
            review = self.reflection_engine.review(user_text, draft)
        self.last_review = review
        return draft
