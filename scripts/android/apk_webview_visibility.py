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
      const composer = document.querySelector('#composer');
      const visibleBottom = Math.min(
        window.innerHeight,
        composer ? composer.getBoundingClientRect().top : window.innerHeight
      );
      if (scroll) {
        // scrollHeight may overshoot the newest answer when the WebView has
        // restored older content. Bring the answer itself into view, then
        // correct its bounds against the fixed composer.
        body.scrollIntoView({block: 'nearest', inline: 'nearest'});
        for (let attempt = 0; attempt < 3; attempt++) {
          const current = body.getBoundingClientRect();
          if (current.top < 8) {
            scroll.scrollTop = Math.max(0, scroll.scrollTop + current.top - 8);
          } else if (current.bottom > visibleBottom - 8) {
            scroll.scrollTop += current.bottom - (visibleBottom - 8);
          } else {
            break;
          }
        }
      }
      const rect = body.getBoundingClientRect();
      const style = getComputedStyle(body);
      const intersectsViewport = rect.width > 0 && rect.height > 0 &&
        rect.bottom > 0 && rect.top < visibleBottom;
      const visible = intersectsViewport && rect.top >= 0 &&
        rect.bottom <= visibleBottom && style.display !== 'none' &&
        style.visibility !== 'hidden' && Number(style.opacity) > 0;
      return {
        visible,
        intersectsViewport,
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        visibleBottom: Math.round(visibleBottom),
        viewportHeight: window.innerHeight,
        scrollTop: scroll ? Math.round(scroll.scrollTop) : null,
        scrollHeight: scroll ? scroll.scrollHeight : null,
        scrollClientHeight: scroll ? scroll.clientHeight : null,
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
