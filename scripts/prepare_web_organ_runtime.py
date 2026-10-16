#!/usr/bin/env python3
"""Prepare browser-loadable organ runtime assets inside the GitHub Pages artifact."""
from __future__ import annotations
import json, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from scripts.mosharrof_registry import build_registry  # noqa: E402


def main() -> int:
    expected = build_registry(ROOT)
    registry_path = ROOT / "web/runtime/organs.registry.json"
    try:
        actual = json.loads(registry_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"ORGAN ASSET PREP: invalid registry artifact: {exc}")
    if actual != expected:
        raise SystemExit("ORGAN ASSET PREP: registry artifact differs from organ manifests")
    copies = {
        "core/organ-registry/index.js": "web/runtime/core/organ-registry/index.js",
        "core/link-manager/index.js": "web/runtime/core/link-manager/index.js",
        "core/organ-runtime/index.js": "web/runtime/core/organ-runtime/index.js",
        "core/organ-runtime/persistent-memory.js": "web/runtime/core/organ-runtime/persistent-memory.js",
        "core/organ-runtime/scoped-api.js": "web/runtime/core/organ-runtime/scoped-api.js",
        "core/personal-memory-engine.js": "web/personal-memory-engine.js",
        "core/organ-runtime/persistent-memory.js": "web/runtime/core/organ-runtime/persistent-memory.js",
        "core/organ-runtime/scoped-api.js": "web/runtime/core/organ-runtime/scoped-api.js",
        "core/ui-module-adapter/index.js": "web/runtime/core/ui-module-adapter/index.js",
        "organs/history/history-ui.js": "web/organs/history/history-ui.js",
        "core/composer-enhancements.js": "web/composer-enhancements.js",
        "core/composer-autogrow.js": "web/composer-autogrow.js",
        "core/device-control.js": "web/device-control.js",
        "core/personal-memory-engine.js": "web/personal-memory-engine.js",
        "core/personal-memory-client.js": "web/personal-memory-client.js",
        "core/video-generation-ui.js": "web/video-generation-ui.js",
        "core/drawer-state-guard.js": "web/core/drawer-state-guard.js",
    }
    for source, destination in copies.items():
        src, dst = ROOT / source, ROOT / destination
        if not src.is_file():
            raise SystemExit(f"ORGAN ASSET PREP: missing {source}")
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst)
    # The composer enhancement is loaded from both the Pages root and core/.
    stop_source = ROOT / "core/composer-stop.js"
    for destination in ("web/composer-stop.js", "web/core/composer-stop.js"):
        target = ROOT / destination
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(stop_source, target)
    # Inject runtime-only enhancements into the prepared Pages artifact; keep the tracked legacy entrypoint frozen.
    index_path = ROOT / "web/index.html"
    index_html = index_path.read_text(encoding="utf-8")
    device_tag = '<script src="./device-control.js"></script>'
    if device_tag not in index_html:
        anchor_tag = '<script src="./sidebar-recovery.js"></script>'
        if anchor_tag not in index_html:
            raise SystemExit("ORGAN ASSET PREP: sidebar script anchor missing for device-control asset")
        index_html = index_html.replace(anchor_tag, anchor_tag + "\n" + device_tag, 1)

    video_tag = '<script src="./video-generation-ui.js"></script>'
    if video_tag not in index_html:
        if device_tag not in index_html:
            raise SystemExit("ORGAN ASSET PREP: device-control script anchor missing for video UI")
        index_html = index_html.replace(device_tag, device_tag + "\n" + video_tag, 1)

    # Add personal memory to the generated Pages artifact only; keep the tracked legacy entrypoint frozen.
    session_anchor = "  var session=loadSessionData();"
    session_memory = """  var personalMemoryClient=null;
  var personalMemoryReady=import("./personal-memory-client.js").then(function(mod){personalMemoryClient=mod.createBrowserPersonalMemory(localStorage);return personalMemoryClient;}).catch(function(error){console.warn("Personal memory unavailable:",error);return null;});
  function memorySignals(text){return personalMemoryReady.then(function(memory){return memory?memory.observe(text):null;}).catch(function(error){console.warn("Memory signal could not be saved:",error);});}
  function personalMemoryContext(text){return personalMemoryReady.then(function(memory){return memory?memory.context(text):"";}).catch(function(error){console.warn("Memory retrieval failed:",error);return "";});}
  function memoryCommand(text){if(!/^(?:(?:আমার\\s*)?(?:ব্যক্তিগত\\s*)?স্মৃতি\\s*(?:দেখাও|দেখান|তালিকা|list)|(?:আমার\\s*)?(?:সব\\s*)?(?:ব্যক্তিগত\\s*)?স্মৃতি\\s*(?:মুছে ফেল|মুছে দাও|clear|delete all)|(?:মনে রাখো|স্মৃতিতে রাখো|remember)\\s*[:：-]?\\s*.+)$/i.test(String(text||"").trim()))return null;return personalMemoryReady.then(function(memory){return memory?memory.command(text):"স্মৃতি-সংরক্ষণ সুবিধা এখন পাওয়া যাচ্ছে না।";});}"""
    if "var personalMemoryReady=import(" not in index_html:
        if session_anchor not in index_html:
            raise SystemExit("ORGAN ASSET PREP: session anchor missing for personal memory")
        index_html = index_html.replace(session_anchor, session_anchor + "\n" + session_memory, 1)

    old_chat_request = '    return fetch(CHAT_WORKER_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:String(t||"").trim(),image:image?image.dataUrl:null,image_name:image?image.name:null,stream_status:true})})'
    new_chat_request = """    var currentText=String(t||"").trim();
    return Promise.resolve(memorySignals(currentText)).then(function(){return personalMemoryContext(currentText);}).then(function(memoryContext){
      var priorHistory=(session.messages||[]).slice(0,-1).filter(function(m){return m&&(m.role==="user"||m.role==="ai")&&typeof m.text==="string";}).slice(-12).map(function(m){return {role:m.role==="ai"?"ai":"user",text:String(m.text||"").slice(0,900)};});
      return fetch(CHAT_WORKER_URL,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:currentText,history:priorHistory,memory_context:memoryContext,image:image?image.dataUrl:null,image_name:image?image.name:null,stream_status:true})});
    })"""
    if "var currentText=String(t||" not in index_html:
        if old_chat_request not in index_html:
            raise SystemExit("ORGAN ASSET PREP: chat request shape changed; memory integration requires review")
        index_html = index_html.replace(old_chat_request, new_chat_request, 1)
    # Store a compact chronological memory record after the successful answer; the full transcript remains in chat history.
    old_chain_end = "      });\n  }\n  function setSpeakButton(button,label){"
    new_chain_end = """      }).then(function(result){
        return personalMemoryReady.then(function(memory){return memory?memory.recordTurn(currentText,result.text,{conversation_id:session.id}):null;})
          .catch(function(error){console.warn("Memory turn could not be saved:",error);})
          .then(function(){return result;});
      });
  }
  function setSpeakButton(button,label){"""
    if "Memory turn could not be saved" not in index_html:
        if old_chain_end not in index_html:
            raise SystemExit("ORGAN ASSET PREP: chat response completion anchor missing for memory recording")
        index_html = index_html.replace(old_chain_end, new_chain_end, 1)

    old_send_prefix = '  function send(){var raw=input.value.trim();if((!raw&&!pendingImage)||busy)return;busy=true;sendBtn.disabled=true;'
    new_send_prefix = """  function send(){var raw=input.value.trim();if((!raw&&!pendingImage)||busy)return;var memoryAction=memoryCommand(raw);if(memoryAction){busy=true;sendBtn.disabled=true;input.value="";resize();addMsg("user",raw);Promise.resolve(memoryAction).then(function(answer){addMsg("ai",String(answer||"স্মৃতি-ব্যবস্থার কাজ শেষ হয়েছে।"));}).catch(function(error){addMsg("ai","স্মৃতি-ব্যবস্থায় সমস্যা হয়েছে: "+String(error&&error.message||error));}).finally(function(){busy=false;sendBtn.disabled=false;input.focus();});return;}busy=true;sendBtn.disabled=true;"""
    if "var memoryAction=memoryCommand(raw);" not in index_html:
        if old_send_prefix not in index_html:
            raise SystemExit("ORGAN ASSET PREP: send handler anchor missing for memory commands")
        index_html = index_html.replace(old_send_prefix, new_send_prefix, 1)
    index_path.write_text(index_html, encoding="utf-8")
    # Preserve the organ-relative import path and the live-page fallback path.
    composer_source = ROOT / "core/composer-enhancements.js"
    composer_runtime = ROOT / "web/core/composer-enhancements.js"
    composer_runtime.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(composer_source, composer_runtime)
    autogrow_source = ROOT / "core/composer-autogrow.js"
    autogrow_runtime = ROOT / "web/core/composer-autogrow.js"
    autogrow_runtime.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(autogrow_source, autogrow_runtime)
    bootstrap = (ROOT / "web/entities/organ-bootstrap.js").read_text(encoding="utf-8")
    extra_bootstrap = (ROOT / "web/entities/ui-organ-modules.js").read_text(encoding="utf-8")
    import_contract = bootstrap + "\n" + extra_bootstrap
    ui_ids = []
    for folder in sorted((ROOT / "organs").iterdir()):
        manifest_path = folder / "organ.json"
        if not folder.is_dir() or not manifest_path.is_file():
            continue
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if not {"getHealth", "reportIssue"}.issubset(set(manifest.get("public_api", []))):
            continue
        organ_id, source = manifest["id"], folder / "index.js"
        if not source.is_file() or f'"../organs/{organ_id}/index.js"' not in import_contract:
            raise SystemExit(f"ORGAN ASSET PREP: UI organ {organ_id} is not wired in bootstrap")
        content = source.read_text(encoding="utf-8").replace("../../web/entities/", "../../entities/").replace("../../core/ui-module-adapter/", "../../runtime/core/ui-module-adapter/")
        if "../../web/entities/" in content:
            raise SystemExit(f"ORGAN ASSET PREP: invalid import in {source}")
        dst = ROOT / "web/organs" / organ_id / "index.js"
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(content, encoding="utf-8")
        ui_ids.append(organ_id)
    required = [ROOT / p for p in (
        "web/runtime/core/organ-registry/index.js", "web/runtime/core/link-manager/index.js",
        "web/runtime/core/organ-runtime/index.js", "web/runtime/core/organ-runtime/persistent-memory.js", "web/runtime/core/organ-runtime/scoped-api.js", "web/organs/chat/index.js", "web/organs/notes/index.js", "web/device-control.js", "web/video-generation-ui.js", "web/personal-memory-client.js", "web/personal-memory-engine.js")]
    if not all(p.is_file() for p in required):
        raise SystemExit("ORGAN ASSET PREP: required browser files are missing")
    print(f"ORGAN ASSET PREP: PASS — {len(ui_ids)} UI organs prepared")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
