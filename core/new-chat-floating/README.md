# New Chat Floating Window Core Module

Owns the top-bar New Chat control and an in-page floating presentation of the existing chat DOM. It reuses the current page/session and does not create a second chat store or modify microphone handlers.

## Entry
`index.js` initializes the control and loads `style.css` relative to this organ.

## Interaction
- Tap the plus control to trigger the existing New Chat action.
- Long-press for 550 ms to float the same app DOM.
- Drag the top bar to move; two-pointer pinch scales the window within bounds.
- Tap or double-tap the plus control while floating to restore full-screen.

## Limitation
This is an in-page floating window. A true cross-app Android overlay and Quick Settings tile behavior require native Android integration and device testing.
