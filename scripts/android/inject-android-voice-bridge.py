#!/usr/bin/env python3
from pathlib import Path
page = Path("android-web/index.html")
html = page.read_text(encoding="utf-8")
link = '<link rel="stylesheet" href="./edge-to-edge.css?v=20261013-6">'
if "edge-to-edge.css" not in html:
    html = html.replace("</head>", f"  {link}\n</head>", 1)
if "edge-to-edge.css" not in html:
    raise SystemExit("Edge-to-edge stylesheet missing from Android web copy")

# Android uses the user's preferred full-screen shell: no visible header slab
# and no centered brand; keep only the two round side controls.
android_header_css = """<style id="mosharrof-android-header-hidden">
header.top,.top {
  background:transparent !important;
  border:0 !important;
  outline:none !important;
  box-shadow:none !important;
  backdrop-filter:none !important;
  -webkit-backdrop-filter:none !important;
}
.top .brand { display:none !important; }
.top .left-btn { grid-column:1 !important; }
.top .right-btn { grid-column:3 !important; }
</style>"""
if 'id="mosharrof-android-header-hidden"' not in html:
    html = html.replace("</head>", f"  {android_header_css}\n</head>", 1)
if 'id="mosharrof-android-header-hidden"' not in html:
    raise SystemExit("Android full-screen header override injection failed")
# Use the native Android overlay as the single movable voice control.
# Speak replies generated from a voice command, using MOSHARROF's configured TTS path.
html = html.replace('var pendingImage=null;', 'var pendingImage=null;\n  var nativeVoiceReplyPending=false;', 1)
html = html.replace(
    'msgEl.appendChild(n);bottom();\n    if(!skipSave)',
    '''msgEl.appendChild(n);bottom();
if(role==="ai"&&nativeVoiceReplyPending){nativeVoiceReplyPending=false;window.setTimeout(function(){var speakButton=n.querySelector(".message-speak-shortcut");if(speakButton)speakButton.click();},150);}
if(!skipSave)''',
    1
)
# Let the native Android voice manager submit speech transcripts through the existing chat pipeline.
bridge = '''function routeAndroidAgentCommand(command) {
  var api = window.MosharrofAndroidAgentCommandRouter;
  if (!api) return null;
  if (!window.mosharrofAndroidAgentRouterInstance) {
    window.mosharrofAndroidAgentRouterInstance = api.createCommandRouter();
  }
  var routed = window.mosharrofAndroidAgentRouterInstance.handle(String(command || ""));
  if (!routed || !routed.handled) return false;
  input.value = ""; resize();
  Promise.resolve(routed.promise).catch(function(error) {
    console.error("Android agent command failed", error);
  });
  return true;
}
function deliverNativeVoiceCommand(text, attempt) {
  var routed = routeAndroidAgentCommand(text);
  if (routed === null && attempt < 20) {
    window.setTimeout(function() { deliverNativeVoiceCommand(text, attempt + 1); }, 100);
    return;
  }
  if (routed === true) return;
  window.mosharrofAutoSpeakNext = true;
  input.value = String(text || ""); resize(); send();
}
window.mosharrofNativeVoiceCommand = function (text) {
  try { deliverNativeVoiceCommand(String(text || ""), 0); return true; }
  catch (error) {
    console.error("Native voice command could not be sent", error); return false;
  }
};
sendBtn.addEventListener("click", function(event) {
  if (routeAndroidAgentCommand(input.value)) {
    event.preventDefault(); event.stopImmediatePropagation();
  }
}, true);
input.addEventListener("keydown", function(event) {
  if (event.key === "Enter" && !event.shiftKey && routeAndroidAgentCommand(input.value)) {
    event.preventDefault(); event.stopImmediatePropagation();
  }
}, true);
'''
marker = "})();\n</script>"
at = html.rfind(marker)
if at < 0:
    raise SystemExit("Could not find chat script closure for native voice bridge")
html = html[:at] + bridge + html[at:]
response_hook = r"""request.then(function(r){var elapsedMs=performance.now()-requestStartedAt;untype();if(imageMode){addGeneratedImage(r);}else{addMsg("ai",r.text,undefined,false,null,undefined,elapsedMs,r.responseMeta);}busy=false;sendBtn.disabled=false;input.focus();})"""
response_replacement = r"""request.then(function(r){var elapsedMs=performance.now()-requestStartedAt;untype();if(imageMode){addGeneratedImage(r);}else{addMsg("ai",r.text,undefined,false,null,undefined,elapsedMs,r.responseMeta);if(window.mosharrofAutoSpeakNext){window.mosharrofAutoSpeakNext=false;window.setTimeout(function(){var nodes=msgEl.querySelectorAll(".message.ai");var last=nodes[nodes.length-1];var speak=last&&last.querySelector(".message-speak-shortcut");if(speak)speak.click();},250);}}busy=false;sendBtn.disabled=false;input.focus();})"""
if response_hook not in html:
    raise SystemExit("Could not find chat response hook for Android voice auto-read")
html = html.replace(response_hook, response_replacement, 1)
page.write_text(html, encoding="utf-8")
