from src.core.mosharrof_brain import MosharrofCoreBrain

def test_core_processes_intent():
    brain = MosharrofCoreBrain()
    result = brain.process_intent("organize the project")
    assert result["status"] == "SUCCESS"

def test_delete_is_denied():
    brain = MosharrofCoreBrain()
    result = brain.monitor_sub_agent("test-entity", {"operation": "DELETE", "status": "PROCESSING"})
    assert result["decision"] == "REJECTED"
