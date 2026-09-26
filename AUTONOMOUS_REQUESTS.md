# Mosharrof Auto Request Channel

## How it works

Create a GitHub Issue whose title starts with **[AUTO]** and write the requested feature in normal language.
You may attach a screenshot when the request is visual/UI related.

The autonomous engine will:
1. inspect the request;
2. work only in an isolated branch;
3. run tests;
4. create a Pull Request;
5. enable controlled auto-merge;
6. let the protected main/Pages pipeline decide promotion;
7. run the live deployment health check.

No autonomous workflow is permitted to push directly to `main`.

For scheduled maintenance, the engine runs every 6 hours and stops safely when no justified change is found.
