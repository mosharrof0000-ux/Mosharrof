from src.core.personal_learning_engine import PersonalLearningEngine


def test_learning_is_opt_in_and_records_only_coarse_metadata():
    engine = PersonalLearningEngine()
    result = engine.record(
        "user-a", "open_calendar", weekday=1, hour=8,
        succeeded=True, learning_enabled=False, share_consent=True,
    )
    assert result["status"] == "IGNORED"
    assert engine.user_summary("user-a")["observation_count"] == 0


def test_personal_prediction_needs_repeated_success_and_never_auto_executes():
    engine = PersonalLearningEngine(min_personal_samples=3)
    for _ in range(3):
        engine.record(
            "user-a", "open_calendar", weekday=1, hour=8,
            succeeded=True, learning_enabled=True,
        )
    # Another user's data must not influence this user's predictions.
    for _ in range(10):
        engine.record(
            "user-b", "send_message", weekday=1, hour=8,
            succeeded=True, learning_enabled=True,
        )

    predictions = engine.predict("user-a", weekday=1, hour=9)
    assert predictions == [{
        "task_type": "open_calendar",
        "confidence": 1.0,
        "observations": 3,
        "requires_user_confirmation": True,
        "auto_execute": False,
    }]


def test_shared_insights_require_distinct_opted_in_users():
    engine = PersonalLearningEngine(min_shared_users=5)
    for index in range(4):
        engine.record(
            f"user-{index}", "check_weather", weekday=2, hour=6,
            succeeded=True, learning_enabled=True, share_consent=True,
        )
    assert engine.shared_insights() == []

    engine.record(
        "user-4", "check_weather", weekday=2, hour=6,
        succeeded=True, learning_enabled=True, share_consent=True,
    )
    insights = engine.shared_insights()
    assert len(insights) == 1
    assert insights[0]["distinct_users"] == 5
    assert insights[0]["success_rate"] == 1.0
    assert insights[0]["contains_user_identifiers"] is False
    assert insights[0]["contains_raw_content"] is False


def test_shared_learning_excludes_nonconsenting_observations():
    engine = PersonalLearningEngine(min_shared_users=2)
    for index in range(4):
        engine.record(
            f"user-{index}", "open_settings", weekday=3, hour=12,
            succeeded=True, learning_enabled=True, share_consent=False,
        )
    assert engine.shared_insights() == []


def test_forget_user_removes_personal_and_shareable_observations():
    engine = PersonalLearningEngine(min_shared_users=2)
    engine.record(
        "user-a", "open_settings", weekday=3, hour=12,
        succeeded=True, learning_enabled=True, share_consent=True,
    )
    result = engine.forget_user("user-a")
    assert result == {"status": "FORGOTTEN", "user_data_removed": True}
    assert engine.user_summary("user-a")["observation_count"] == 0
    assert engine.shared_insights() == []
