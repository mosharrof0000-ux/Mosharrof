"""Visibility assertion helpers for the installed Android WebView smoke test."""
from __future__ import annotations

import json


def inspect_visible_answer(cdp) -> dict:
    """Return DOM geometry and computed visibility for the latest assistant answer."""
    state = cdp.evaluate("""(() => {
      const nodes = [...document.querySelectorAll('#messages .message.ai:not(.typing)')];
      const last = nodes[nodes.length - 1];
      const body = last && last.querySelector('.rich-content');
      if (!body) return {visible:false, reason:'assistant answer element missing'};
      const rect = body.getBoundingClientRect();
      const style = getComputedStyle(body);
      const visible = rect.width > 0 && rect.height > 0 &&
        style.display !== 'none' && style.visibility !== 'hidden' &&
        Number(style.opacity || 1) > 0;
      return {visible, width:rect.width, height:rect.height, textChars:(body.innerText || '').trim().length};
    })()""")
    return state if isinstance(state, dict) else {"visible": False, "reason": "invalid CDP result"}
