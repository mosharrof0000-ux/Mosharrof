# User Preference Intelligence test plan

Run with Node's built-in test runner:
`node --experimental-default-type=module --test organs/user-preference-intelligence/tests/preference-intelligence.test.mjs`

Required coverage:
- valid explicit preferences are stored and scoped;
- unsupported scope, unsafe keys, empty values, and invalid confidence are rejected;
- low-confidence inferences are rejected;
- inferred values cannot overwrite explicit/corrected values;
- corrections are authoritative;
- forgetting removes only the requested scope;
- reading returns copies and cannot mutate internal state;
- no network, filesystem, or cross-organ calls are performed.
