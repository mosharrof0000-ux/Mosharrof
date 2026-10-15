# Continuous Learning Orchestrator tests

Node built-in test command:
`node --experimental-default-type=module --test organs/continuous-learning-orchestrator/tests/continuous-learning.test.mjs`

Required checks:
- valid cycle and allowed learning domains;
- rejection of unknown domains, unsafe IDs, malformed dates, and invalid evidence caps;
- only HTTPS source URLs; reject embedded credentials and other protocols;
- evidence domain must be declared in the cycle and reliability values are enumerated;
- evidence reference indexes must exist;
- bounded evidence, gaps, and proposals;
- proposals cannot enable Live mutation or external access and protected actions require approval;
- completed cycle cannot be reopened;
- reports are copies and cannot mutate internal state;
- no network, filesystem, process, scheduler, or cross-organ side effects.
