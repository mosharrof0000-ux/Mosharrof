# Tests

The repository's pytest suite runs `tests/test_android_agent_bridge_contract.py`, which validates the organ manifest, bounded module size, security contract markers, and JavaScript module syntax when Node.js is available.

Physical-device acceptance remains required: pair on the same phone/browser, issue one install and one uninstall request, complete Android's system confirmation screens, and confirm the signed callback shows the same request ID and verified package state. A CI build alone is not physical-device evidence.
