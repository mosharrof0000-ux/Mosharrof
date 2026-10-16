from src.core.brain_adapter import BrainAdapter
from src.core.reflective_brain import ReflectiveBrain


class FakeProvider:
    def __init__(self, responses):
        self.responses = list(responses)
        self.prompts = []

    def generate(self, prompt, **kwargs):
        self.prompts.append(prompt)
        return self.responses.pop(0)


def test_reflective_brain_uses_plan_before_provider_response():
    provider = FakeProvider(["আপনার অনুরোধ বুঝেছি। আগে লক্ষ্য যাচাই করব, তারপর সমাধান দেব।"])
    brain = ReflectiveBrain(BrainAdapter("chat", provider))
    answer = brain.generate("আমার কাজটা বুঝে বাস্তবায়ন করুন")
    assert "সমাধান দেব" in answer
    assert brain.last_plan["user_goal"]
    assert "Response plan:" in provider.prompts[0]
    assert brain.last_review["ready"] is True


def test_reflective_brain_retries_unsupported_mind_reading_claim():
    provider = FakeProvider([
        "আমি আপনার মন পড়তে পারি এবং সব জানি।",
        "আমি আপনার কথার সংকেত থেকে সম্ভাব্য প্রয়োজন বুঝতে চেষ্টা করব; নিশ্চিত না হলে জিজ্ঞেস করব।",
    ])
    brain = ReflectiveBrain(BrainAdapter("chat", provider))
    answer = brain.generate("আমার মন বুঝতে চেষ্টা করো")
    assert "সম্ভাব্য প্রয়োজন" in answer
    assert len(provider.prompts) == 2
    assert brain.last_review["ready"] is True


def test_reflective_brain_without_provider_fails_explicitly():
    brain = ReflectiveBrain(BrainAdapter("chat"))
    try:
        brain.generate("হ্যালো")
    except RuntimeError as error:
        assert str(error) == "NO_BRAIN_PROVIDER_ATTACHED"
    else:
        raise AssertionError("missing provider must not pretend to answer")
