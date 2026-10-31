"""Read-only CDP snapshots for the Android WebView real-chat acceptance test."""


def answer_state_js(baseline: int) -> str:
    """Read the latest assistant answer and its provider route without resubmitting."""
    return f"""(() => {{
      const send = document.querySelector('#sendBtn');
      const typing = document.querySelector('#typing');
      const nodes = [...document.querySelectorAll('#messages .message.ai:not(.typing)')];
      const last = nodes[nodes.length - 1];
      const body = last && last.querySelector('.rich-content');
      const routeNode = last && last.querySelector('.response-route');
      const route = routeNode ? routeNode.innerText.trim() : '';
      const match = route.match(/উত্তর\\s*:\\s*([^·]+)/);
      const winner = match ? match[1].trim() : '';
      const provider = winner && !/^AI$/i.test(winner) && winner !== 'MOSHARROF AI' ? winner : null;
      const model = route.indexOf('·') >= 0 ? route.split('·').pop().trim() : null;
      return {{
        ready: !!send && !send.disabled && !typing && nodes.length > {baseline} &&
               !!body && body.innerText.trim().length > 0,
        count: nodes.length,
        typing: !!typing,
        answer: body ? body.innerText.trim() : '',
        provider,
        model,
        route
      }};
    }})()"""


def layout_visibility_js() -> str:
    """Measure the answer and every relevant flex ancestor before/after the single scroll."""
    return """(() => {
      const nodes = [...document.querySelectorAll('#messages .message.ai:not(.typing)')];
      const last = nodes[nodes.length - 1];
      const body = last && last.querySelector('.rich-content');
      if (!body || !body.innerText.trim()) return {visible:false, text:'', rect:null};
      const box = e => {
        if (!e) return null;
        const s = getComputedStyle(e), r = e.getBoundingClientRect();
        return {rect:{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height},
          offset:{width:e.offsetWidth,height:e.offsetHeight},client:{width:e.clientWidth,height:e.clientHeight},
          css:{display:s.display,position:s.position,width:s.width,minWidth:s.minWidth,maxWidth:s.maxWidth,
            flex:s.flex,flexBasis:s.flexBasis,alignSelf:s.alignSelf,alignItems:s.alignItems,
            gridColumns:s.gridTemplateColumns,gridRows:s.gridTemplateRows,
            overflowX:s.overflowX,overflowY:s.overflowY,boxSizing:s.boxSizing,transform:s.transform}};
      };
      const els = {html:document.documentElement,body:document.body,app:document.querySelector('.app'),
        content:document.querySelector('.content'),hero:document.querySelector('.hero'),
        chatScroll:document.querySelector('#chatScroll'),messages:document.querySelector('#messages'),
        message:last,rich:body,first:body.firstElementChild};
      const snap = () => Object.fromEntries(Object.entries(els).map(([k,e]) => [k,box(e)]));
      const before = snap();
      body.scrollIntoView({block:'center', inline:'nearest', behavior:'instant'});
      const after = snap(), r = body.getBoundingClientRect(), m = last.getBoundingClientRect();
      const scroll = document.querySelector('#chatScroll');
      return {visible:m.width>0 && m.height>0 && r.width>0 && r.height>0 &&
          r.bottom>0 && r.top<window.innerHeight && r.right>0 && r.left<window.innerWidth,
        text:body.innerText.trim(),rect:{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height},
        messageRect:{top:m.top,bottom:m.bottom,left:m.left,right:m.right,width:m.width,height:m.height},
        viewport:{width:window.innerWidth,height:window.innerHeight,dpr:window.devicePixelRatio,
          visualWidth:window.visualViewport&&window.visualViewport.width,
          visualHeight:window.visualViewport&&window.visualViewport.height},
        scroll:{top:scroll?scroll.scrollTop:0,left:scroll?scroll.scrollLeft:0,
          clientWidth:scroll?scroll.clientWidth:0,scrollWidth:scroll?scroll.scrollWidth:0,
          clientHeight:scroll?scroll.clientHeight:0,scrollHeight:scroll?scroll.scrollHeight:0},
        stylesheets:[...document.styleSheets].map(x=>x.href||'inline'),layout:{before,after}};
    })()"""
