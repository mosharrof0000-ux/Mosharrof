"""Apply manual chat/STT/TTS preferences to the prepared Pages HTML."""

def apply_manual_provider_patches(index_html: str) -> str:
    old_chat_request = 'body:JSON.stringify({text:String(t||"").trim(),image:image?image.dataUrl:null,image_name:image?image.name:null,stream_status:true})'
    new_chat_request = 'body:JSON.stringify({text:String(t||"").trim(),history:(session.messages||[]).slice(0,-1).filter(function(m){return m&&(m.role==="user"||m.role==="ai")&&typeof m.text==="string";}).slice(-12).map(function(m){return {role:m.role==="ai"?"ai":"user",text:String(m.text||"").slice(0,900)};}),image:image?image.dataUrl:null,image_name:image?image.name:null,stream_status:true,provider:(function(){try{return (localStorage.getItem("mosharrof_chat_route_v1")||"auto").split("|")[0];}catch(e){return "auto";}})(),model:(function(){try{return (localStorage.getItem("mosharrof_chat_route_v1")||"auto").split("|")[1]||"";}catch(e){return "";}})()})'
    if new_chat_request not in index_html:
        if old_chat_request not in index_html:
            raise SystemExit("ORGAN ASSET PREP: chat request shape changed; history injection requires review")
        index_html = index_html.replace(old_chat_request, new_chat_request, 1)
    old_voice_stream = 'voiceStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:true}});'
    new_voice_stream = old_voice_stream + 'document.dispatchEvent(new CustomEvent("vm",{detail:voiceStream}));'
    if new_voice_stream not in index_html:
        if old_voice_stream not in index_html:
            raise SystemExit("ORGAN ASSET PREP: voice stream anchor changed; microphone activity meter requires review")
        index_html = index_html.replace(old_voice_stream, new_voice_stream, 1)

    old_stt_request = 'body:JSON.stringify({audio_base64:parts[1],mime_type:String(blob.type||"audio/webm").split(";")[0],language:getSttLanguage()})'
    new_stt_request = 'body:JSON.stringify({audio_base64:parts[1],mime_type:String(blob.type||"audio/webm").split(";")[0],language:getSttLanguage(),model:(function(){try{return localStorage.getItem("mosharrof_stt_model_v1")||"auto";}catch(e){return "auto";}})()})'
    if new_stt_request not in index_html:
        if old_stt_request not in index_html:
            raise SystemExit("ORGAN ASSET PREP: transcription request shape changed; manual STT selection requires review")
        index_html = index_html.replace(old_stt_request, new_stt_request, 1)
    
    old_tts_fallback = 'button.disabled=false;hideV();speakWithBrowser(spokenText,button);toast("সার্ভার ভয়েস ব্যর্থ: "+detail+" · Browser Voice ব্যবহার হচ্ছে",6000);'
    new_tts_fallback = 'button.disabled=false;hideV();if(preference==="auto"){speakWithBrowser(spokenText,button);toast("সার্ভার ভয়েস ব্যর্থ: "+detail+" · Browser Voice ব্যবহার হচ্ছে",6000);}else{resetSpeakButton(button);toast("নির্বাচিত ভয়েস ইঞ্জিন ব্যর্থ: "+detail+" · অন্য ইঞ্জিনে যাওয়া হয়নি",6000);}'
    if new_tts_fallback not in index_html:
        if old_tts_fallback not in index_html:
            raise SystemExit("ORGAN ASSET PREP: TTS fallback shape changed; manual provider policy requires review")
        index_html = index_html.replace(old_tts_fallback, new_tts_fallback, 1)
    return index_html
