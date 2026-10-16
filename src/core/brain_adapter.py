"""Model-agnostic brain adapter contract for Mosharrof entities."""
from typing import Any, Dict, Optional, Protocol

from src.core.intent_reflection_engine import IntentReflectionEngine


class BrainProvider(Protocol):
    def generate(self, prompt: str, **kwargs: Any) -> str: ...


class BrainAdapter:
    def __init__(
        self,
        entity_id: str,
        provider: BrainProvider | None = None,
        reflection_engine: Optional[IntentReflectionEngine] = None,
    ):
        self.entity_id = entity_id
        self.provider = provider
        self.reflection_engine = reflection_engine or IntentReflectionEngine()
        self.last_reflection_plan: Optional[Dict[str, object]] = None
        self.last_response_review: Optional[Dict[str, object]] = None

    def attach(self, provider: BrainProvider) -> None:
        self.provider = provider

    def describe(self) -> Dict[str, Any]:
        return {
            "entity_id": self.entity_id,
            "provider_attached": self.provider is not None,
            "model_independent_identity": True,
            "reflective_response_planning": True,
        }

    def generate(self, prompt: str, **kwargs: Any) -> str:
        if self.provider is None:
            raise RuntimeError("NO_BRAIN_PROVIDER_ATTACHED")
        return self.provider.generate(prompt, **kwargs)

    def generate_reflective(
        self,
        user_text: str,
        *,
        context: Optional[Dict[str, str]] = None,
        **kwargs: Any,
    ) -> str:
        """Plan for intent/uncertainty first, then review the answer before returning it.

        The provider receives a compact response plan, not hidden chain-of-thought.
        Context must be authorized and minimal; this method never executes actions.
        """
        if self.provider is None:
            raise RuntimeError("NO_BRAIN_PROVIDER_ATTACHED")
        plan = self.reflection_engine.prepare(user_text, context=context)
        self.last_reflection_plan = plan
        prompt = (
            "Answer the user's request in their language. Before drafting, use this "
            "compact response plan to consider their explicit goal, possible need, "
            "uncertainty, and constraints. Treat emotional cues as tentative, never "
            "claim to read minds, and ask the supplied clarification question if "
            "needed. Do not reveal private chain-of-thought; provide only the answer "
            "and a brief rationale when useful. Never claim an action succeeded "
            "without evidence.\n\n"
            f"Response plan: {plan}\n\n"
            f"User message: {user_text}"
        )
        draft = self.provider.generate(prompt, **kwargs)
        review = self.reflection_engine.review(user_text, draft)
        if not review["ready"]:
            retry_prompt = (
                f"{prompt}\n\nReview findings: {review['issues']}. "
                "Revise the answer to resolve these issues. Return only the revised answer."
            )
            draft = self.provider.generate(retry_prompt, **kwargs)
            review = self.reflection_engine.review(user_text, draft)
        self.last_response_review = review
        return draft
