# Mosharrof Visual QA Engine

The autonomous visual layer renders the proposed build in Chromium before promotion.

**Code → isolated/preview build → real browser → screenshots → UI/overflow checks → optional baseline comparison → verification gate → promotion**

It verifies the rendered result rather than trusting source code alone. Screenshots are retained as CI artifacts. A large baseline difference blocks promotion.
