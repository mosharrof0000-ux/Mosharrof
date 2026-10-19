# MOSHARROF Universal Automation Control Center

Permanent control surface for work that must survive ChatGPT Free usage limits and conversation changes.

Control issue: https://github.com/mosharrof0000-ux/Mosharrof/issues/756

## Commands (post as a comment on issue #756)
- `/mosharrof start` — run one bounded backlog task now.
- `/mosharrof resume` — run the next bounded task/checkpoint now.
- `/mosharrof status` — comment back with latest Actions runs and open review PRs.

Only comments from the repository owner account are accepted. Other issue comments do not start work. Scheduled and APK/real-chat workflow triggers remain available.

## Safety and continuity
- Runs start from protected `main`, implement a bounded task, run baseline/full tests and protected-change checks, then open a review-only PR.
- No automatic merge or production deploy is performed by this control command.
- Run logs, artifacts and PRs are the durable task evidence; ChatGPT conversation continuity is not required.
- Never paste API keys or other secrets into issues/comments.
- Physical Android device testing remains distinct from emulator testing.
