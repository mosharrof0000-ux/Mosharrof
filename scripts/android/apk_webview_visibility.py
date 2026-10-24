"""Visibility proof helpers for the installed Android WebView chat smoke test."""
from __future__ import annotations

import json
import time


def ensure_answer_visible(cdp, expected_answer: str) -> dict:
    """Scroll the last assistant answer above the composer and verify its viewport bounds."""
    expression = """
    (() => {
      const expected = __EXPECTED__;
      const scroll = document.querySelector('#chatScroll');
      const nodes = [...document.querySelectorAll('#messages .message.ai:not(.typing)')];
      const last = nodes[nodes.length - 1];
      const body = last && last.querySelector('.rich-content');
      if (!last || !body || body.innerText.trim() !== expected.trim()) {
        return {visible: false, reason: 'answer_not_last_dom_message'};
      }
      if (scroll) scroll.scrollTop = scroll.scrollHeight;
      const rect = body.getBoundingClientRect();
      const composer = document.querySelector('#composer');
      const visibleBottom = Math.min(
        window.innerHeight,
        composer ? composer.getBoundingClientRect().top : window.innerHeight
      );
      const style = getComputedStyle(body);
      const visible = rect.width > 0 && rect.height > 0 && rect.bottom > 0 &&
        rect.top < visibleBottom && style.display !== 'none' &&
        style.visibility !== 'hidden' && Number(style.opacity) > 0;
      return {
        visible,
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        visibleBottom: Math.round(visibleBottom),
        viewportHeight: window.innerHeight,
        answerText: body.innerText.trim().slice(0, 120)
      };
    })()
    """.replace("__EXPECTED__", json.dumps(expected_answer, ensure_ascii=False))

    result = {}
    for _ in range(3):
        result = cdp.evaluate(expression)
        if result and result.get("visible"):
            return result
        time.sleep(0.25)
    return result or {"visible": False, "reason": "no_visibility_result"}
