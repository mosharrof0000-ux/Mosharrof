"""Small, isolated DOM visibility assertion for installed APK chat QA."""
from __future__ import annotations
import json


def ensure_visible_answer(cdp):
    """Scroll the latest assistant reply into view and report rendered visibility."""
    return cdp.evaluate("""(() => {
      const messages = document.querySelector('#messages');
      const nodes = [...document.querySelectorAll('#messages .message.ai:not(.typing)')];
      const last = nodes[nodes.length - 1];
      const body = last && last.querySelector('.rich-content');
      if (!last || !body) return {visible:false, reason:'assistant bubble/content missing'};
      last.scrollIntoView({block:'end', inline:'nearest'});
      if (messages) messages.scrollTop = messages.scrollHeight;
      const r = body.getBoundingClientRect();
      const cs = getComputedStyle(body);
      const visible = r.width > 0 && r.height > 0 && r.bottom > 0 &&
        r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth &&
        cs.display !== 'none' && cs.visibility !== 'hidden' &&
        Number(cs.opacity) > 0 && body.innerText.trim().length > 0;
      return {visible, top:r.top, bottom:r.bottom, width:r.width, height:r.height,
        viewportHeight:window.innerHeight, display:cs.display, visibility:cs.visibility,
        opacity:cs.opacity, text:body.innerText.trim()};
    })()""")
