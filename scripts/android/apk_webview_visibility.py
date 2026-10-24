"""Visibility proof helpers for the installed Android WebView chat smoke test."""
from __future__ import annotations

import json
import time


def ensure_answer_visible(cdp, expected_answer: str) -> dict:
    """Scroll the last assistant answer into the actual WebView scroll viewport."""
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
      const bounds = () => {
        const area = scroll ? scroll.getBoundingClientRect() : {top: 0, bottom: window.innerHeight};
        const top = Math.max(0, area.top);
        const bottom = Math.min(
          window.innerHeight,
          composer ? composer.getBoundingClientRect().top : window.innerHeight,
          area.bottom
        );
        return {top, bottom};
      };
      if (scroll) {
        body.scrollIntoView({block: 'nearest', inline: 'nearest'});
        for (let attempt = 0; attempt < 5; attempt++) {
          const current = body.getBoundingClientRect();
          const visible = bounds();
          if (current.top < visible.top + 8) {
            scroll.scrollTop = Math.max(0, scroll.scrollTop + current.top - (visible.top + 8));
          } else if (current.bottom > visible.bottom - 8) {
            scroll.scrollTop += current.bottom - (visible.bottom - 8);
          } else {
            break;
          }
        }
      }
      const rect = body.getBoundingClientRect();
      const messageRect = last.getBoundingClientRect();
      const visible = bounds();
      const style = getComputedStyle(body);
      const intersectsViewport = rect.width > 0 && rect.height > 0 &&
        rect.bottom > visible.top && rect.top < visible.bottom &&
        rect.right > 0 && rect.left < window.innerWidth;
      const fullyVisible = intersectsViewport && rect.top >= visible.top &&
        rect.bottom <= visible.bottom && style.display !== 'none' &&
        style.visibility !== 'hidden' && Number(style.opacity) > 0;
      return {
        visible: fullyVisible,
        intersectsViewport,
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        visibleTop: Math.round(visible.top),
        visibleBottom: Math.round(visible.bottom),
        viewportHeight: window.innerHeight,
        messageWidth: Math.round(messageRect.width),
        messageHeight: Math.round(messageRect.height),
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        color: style.color,
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
