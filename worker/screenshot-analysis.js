const ORIGIN="https://mosharrof0000-ux.github.io";
const MAX_BYTES=12*1024*1024;
const headers={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Methods":"POST, OPTIONS, GET","Access-Control-Allow-Headers":"content-type","Vary":"Origin"};
function reply(data,status){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8",...headers}})}

const CHAT_MODELS=["gemini-3.8-flash","gemini-3.7-flash","gemini-3.6-flash","gemini-3.5-flash","gemini-2.5-flash"];
const VISION_MODELS=["gemini-3.8-flash","gemini-3.7-flash","gemini-3.6-flash","gemini-2.5-flash"];
const IMAGE_MODELS=["gemini-nano-banana-2.1","gemini-3.1-flash-image","gemini-3-pro-image"];
const FREE_IMAGE_PROVIDERS=["gemini","cloudflare-workers-ai"];
const TTS_PROVIDERS=["edge","gemini","azure","elevenlabs","sarvam"];

function base64ToDataUrl(base64,mime){return "data:"+mime+";base64,"+base64;}
function elevenLabsKeyExpired(env){const raw=String(env.ELEVENLABS_KEY_EXPIRES_AT||"").trim();if(!raw)return false;const t=Date.parse(raw);return Number.isFinite(t)&&Date.now()>=t;}

async function generateWithEdge(text,body,env){
  const endpoint=String(env.EDGE_TTS_API_URL||"").trim();
  if(!endpoint)return {ok:false,provider:"edge",reason:"not_configured"};
  try{
    const parsed=new URL(endpoint);
    if(parsed.protocol!=="https:" && parsed.hostname!=="localhost" && parsed.hostname!=="127.0.0.1")return {ok:false,provider:"edge",reason:"https_required"};
    const edgeHeaders={"content-type":"application/json","accept":"audio/mpeg, audio/*, application/json"};
    if(env.EDGE_TTS_API_TOKEN)edgeHeaders.authorization="Bearer "+env.EDGE_TTS_API_TOKEN;
    const r=await fetch(endpoint,{method:"POST",headers:edgeHeaders,body:JSON.stringify({
      text,
      voice:String(body.voice||env.EDGE_TTS_VOICE||"bn-BD-PradeepNeural"),
      language_code:String(body.language_code||"bn-BD"),
      pace:Number(body.pace||1),
      rate:String(body.rate||"+0%"),
      output_format:"audio/mpeg"
    })});
    const type=String(r.headers.get("content-type")||"").toLowerCase();
    if(!r.ok){const detail=type.includes("json")?JSON.stringify(await r.json().catch(()=>({}))):await r.text().catch(()=>"");return {ok:false,provider:"edge",reason:detail||("HTTP "+r.status),status:r.status};}
    if(type.includes("json")){
      const data=await r.json().catch(()=>({}));
      const audio=data.audio_data||data.audio_base64||data.audio;
      if(typeof audio==="string"&&audio.length)return {ok:true,provider:"edge",model:String(data.model||"Edge-TTS"),mime_type:String(data.mime_type||"audio/mpeg"),audio_data:audio.replace(/^data:audio\/[^;]+;base64,/i,"")};
      return {ok:false,provider:"edge",reason:"empty_audio"};
    }
    const bytes=new Uint8Array(await r.arrayBuffer());
    if(!bytes.length)return {ok:false,provider:"edge",reason:"empty_audio"};
    return {ok:true,provider:"edge",model:"Edge-TTS",mime_type:type.split(";")[0]||"audio/mpeg",audio_data:bytesToBase64(bytes)};
  }catch(e){return {ok:false,provider:"edge",reason:String(e&&e.message||e)};}
}


function wavFromPcmBase64(pcmBase64,sampleRate=24000,channels=1,bitsPerSample=16){
  const binary=atob(pcmBase64),data=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)data[i]=binary.charCodeAt(i);
  const out=new Uint8Array(44+data.length),view=new DataView(out.buffer);
  const write=(offset,value)=>{for(let i=0;i<value.length;i++)out[offset+i]=value.charCodeAt(i);};
  write(0,"RIFF");view.setUint32(4,36+data.length,true);write(8,"WAVE");write(12,"fmt ");view.setUint32(16,16,true);
  view.setUint16(20,1,true);view.setUint16(22,channels,true);view.setUint32(24,sampleRate,true);
  view.setUint32(28,sampleRate*channels*bitsPerSample/8,true);view.setUint16(32,channels*bitsPerSample/8,true);
  view.setUint16(34,bitsPerSample,true);write(36,"data");view.setUint32(40,data.length,true);out.set(data,44);
  return bytesToBase64(out);
}
function concatWavBase64(chunks){
  const pcm=[];
  for(const b64 of chunks){
    const bin=atob(b64);
    if(bin.length<44||bin.slice(0,4)!=="RIFF"||bin.slice(8,12)!=="WAVE")throw new Error("invalid_wav_chunk");
    for(let i=44;i<bin.length;i++)pcm.push(bin.charCodeAt(i));
  }
  const bytes=new Uint8Array(pcm.length);for(let i=0;i<pcm.length;i++)bytes[i]=pcm[i];
  return wavFromPcmBase64(bytesToBase64(bytes));
}
async function generateWithGeminiTTS(text,body,env){
  if(!env.GEMINI_API_KEY)return {ok:false,provider:"gemini",reason:"not_configured"};
  const model=String(env.GEMINI_TTS_MODEL||"gemini-3.8-flash-tts");
  const voice=String(body.gemini_voice||env.GEMINI_TTS_VOICE||"Kore");
  try{
    const r=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+encodeURIComponent(model)+":generateContent",{
      method:"POST",headers:{"content-type":"application/json","x-goog-api-key":env.GEMINI_API_KEY},
      body:JSON.stringify({contents:[{role:"user",parts:[{text:"Read the following text aloud naturally in Bengali. Preserve its meaning and pronunciation. Do not add commentary.\n\n"+text}]}],
        generationConfig:{responseModalities:["AUDIO"],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:voice}}}}})
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok)return {ok:false,provider:"gemini",reason:data?.error?.message||("HTTP "+r.status),status:r.status};
    const parts=data?.candidates?.[0]?.content?.parts||[];
    const audioPart=parts.find(p=>p?.inlineData?.data||p?.inline_data?.data);
    const audio=audioPart?.inlineData||audioPart?.inline_data;
    if(!audio?.data)return {ok:false,provider:"gemini",reason:"empty_audio",status:r.status};
    const mime=String(audio.mimeType||audio.mime_type||"audio/pcm;rate=24000").toLowerCase();
    if(mime.includes("wav"))return {ok:true,provider:"gemini",model,mime_type:"audio/wav",audio_data:audio.data};
    if(mime.includes("pcm")||mime.includes("l16"))return {ok:true,provider:"gemini",model,mime_type:"audio/wav",audio_data:wavFromPcmBase64(audio.data)};
    return {ok:false,provider:"gemini",reason:"unsupported_audio_format:"+mime};
  }catch(e){return {ok:false,provider:"gemini",reason:String(e&&e.message||e)};}
}
async function generateWithAzure(text,body,env){
  const key=String(env.AZURE_SPEECH_KEY||"").trim(),region=String(env.AZURE_SPEECH_REGION||"").trim();
  if(!key||!region)return {ok:false,provider:"azure",reason:"not_configured"};
  const requestedVoice=String(body.voice||"bn-BD-PradeepNeural");
  const voice=requestedVoice==="bn-BD-NabanitaNeural"?"bn-BD-NabanitaNeural":"bn-BD-PradeepNeural";
  const escapeXml=value=>String(value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;");
  const ssml='<speak version="1.0" xml:lang="bn-BD"><voice name="'+voice+'">'+escapeXml(text)+'</voice></speak>';
  try{
    const r=await fetch("https://"+encodeURIComponent(region)+".tts.speech.microsoft.com/cognitiveservices/v1",{
      method:"POST",headers:{"Ocp-Apim-Subscription-Key":key,"Content-Type":"application/ssml+xml","X-Microsoft-OutputFormat":"audio-24khz-48kbitrate-mono-mp3","User-Agent":"MOSHARROF-AI"},
      body:ssml
    });
    if(!r.ok)return {ok:false,provider:"azure",reason:(await r.text().catch(()=> ""))||("HTTP "+r.status),status:r.status};
    const bytes=new Uint8Array(await r.arrayBuffer());
    if(!bytes.length)return {ok:false,provider:"azure",reason:"empty_audio"};
    return {ok:true,provider:"azure",model:"Azure AI Speech · "+voice,mime_type:"audio/mpeg",audio_data:bytesToBase64(bytes)};
  }catch(e){return {ok:false,provider:"azure",reason:String(e&&e.message||e)};}
}

async function generateWithSarvam(text,body,env){
  if(!env.SARVAM_API_KEY)return {ok:false,provider:"sarvam",reason:"not_configured"};
  try{
    const r=await fetch("https://api.sarvam.ai/text-to-speech",{method:"POST",headers:{"content-type":"application/json","api-subscription-key":env.SARVAM_API_KEY},body:JSON.stringify({text,model:"bulbul:v3",language_code:String(body.language_code||"bn-IN"),speaker:String(body.speaker||"rehan"),pace:Number(body.pace||1),speech_sample_rate:24000,output_audio_codec:"mp3"})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok)return {ok:false,provider:"sarvam",reason:data?.error?.message||data?.message||("HTTP "+r.status),status:r.status};
    const audio=Array.isArray(data.audios)?data.audios[0]:null;
    if(!audio)return {ok:false,provider:"sarvam",reason:"empty_audio",status:r.status};
    return {ok:true,provider:"sarvam",model:"bulbul:v3",mime_type:"audio/mpeg",audio_data:audio};
  }catch(e){return {ok:false,provider:"sarvam",reason:String(e&&e.message||e)};}
}

async function generateWithElevenLabs(text,body,env){
  if(!env.ELEVENLABS_API_KEY)return {ok:false,provider:"elevenlabs",reason:"not_configured"};
  if(elevenLabsKeyExpired(env))return {ok:false,provider:"elevenlabs",reason:"credential_expired"};
  const allowPaid=String(env.ELEVENLABS_ALLOW_PAID||"false").toLowerCase()==="true";
  if(!allowPaid){
    try{
      const q=await fetch("https://api.elevenlabs.io/v1/user/subscription",{headers:{"xi-api-key":env.ELEVENLABS_API_KEY}});
      const s=await q.json().catch(()=>({}));
      const remaining=Math.max(0,Number(s.character_limit||0)-Number(s.character_count||0));
      if(q.ok && remaining<text.length)return {ok:false,provider:"elevenlabs",reason:"free_quota_insufficient",remaining,character_limit:Number(s.character_limit||0),character_count:Number(s.character_count||0)};
    }catch(e){}
  }
  const voice=String(body.voice_id||env.ELEVENLABS_VOICE_ID||"JBFqnCBsd6RMkjVDRZzb");
  try{
    const r=await fetch("https://api.elevenlabs.io/v1/text-to-speech/"+encodeURIComponent(voice),{method:"POST",headers:{"content-type":"application/json","xi-api-key":env.ELEVENLABS_API_KEY,"accept":"audio/mpeg"},body:JSON.stringify({text,model_id:String(env.ELEVENLABS_MODEL||"eleven_v3"),output_format:"mp3_44100_128"})});
    if(!r.ok){const t=await r.text().catch(()=>"");return {ok:false,provider:"elevenlabs",reason:t||("HTTP "+r.status),status:r.status};}
    const bytes=new Uint8Array(await r.arrayBuffer());
    if(!bytes.length)return {ok:false,provider:"elevenlabs",reason:"empty_audio",status:r.status};
    return {ok:true,provider:"elevenlabs",model:String(env.ELEVENLABS_MODEL||"eleven_v3"),mime_type:"audio/mpeg",audio_data:bytesToBase64(bytes)};
  }catch(e){return {ok:false,provider:"elevenlabs",reason:String(e&&e.message||e)};}
}

function splitTtsText(text,maxChars=2200){
  const parts=[];
  let rest=text.trim();
  while(rest.length>maxChars){
    const window=rest.slice(0,maxChars);
    let cut=Math.max(window.lastIndexOf("।"),window.lastIndexOf("!"),window.lastIndexOf("?"),window.lastIndexOf("\n"));
    if(cut<900)cut=Math.max(window.lastIndexOf(" "),window.lastIndexOf(","),window.lastIndexOf(" "));
    if(cut<1)cut=maxChars;
    parts.push(rest.slice(0,cut+1).trim());
    rest=rest.slice(cut+1).trim();
  }
  if(rest)parts.push(rest);
  return parts;
}

function concatBase64Audio(chunks){
  const bytes=[];
  for(const b64 of chunks){
    const bin=atob(b64);
    for(let i=0;i<bin.length;i++)bytes.push(bin.charCodeAt(i));
  }
  return bytesToBase64(new Uint8Array(bytes));
}

async function synthesizeWithProvider(provider,chunks,body,env){
  const audios=[];
  let model=null;
  for(const chunk of chunks){
    const result=provider==="edge"
      ? await generateWithEdge(chunk,body,env)
      : provider==="gemini"
        ? await generateWithGeminiTTS(chunk,body,env)
        : provider==="azure"
          ? await generateWithAzure(chunk,body,env)
          : provider==="sarvam"
            ? await generateWithSarvam(chunk,body,env)
            : provider==="elevenlabs"
              ? await generateWithElevenLabs(chunk,body,env)
              : {ok:false,provider,reason:"unsupported_provider"};
    if(!result.ok)return {ok:false,provider,reason:result.reason||"provider_failed",status:result.status,model:result.model||model};
    audios.push(result.audio_data);
    model=result.model||model;
  }
  const isGemini=provider==="gemini";
  return {ok:true,provider,model,mime_type:isGemini?"audio/wav":"audio/mpeg",audio_data:isGemini?concatWavBase64(audios):concatBase64Audio(audios),chunks:chunks.length};
}

async function tts(request,env){
  const body=await request.json();
  const text=String(body.text||"").trim();
  if(!text)return reply({error:"text_required"},400);
  if(text.length>12000)return reply({error:"text_too_large"},413);
  const chunks=splitTtsText(text,2200);
  const requested=String(body.provider||"auto").toLowerCase();
  const genre=String(body.genre||"").toLowerCase();
  const valid=["auto","edge","gemini","azure","elevenlabs","sarvam"].includes(requested)?requested:"auto";
  let providers;
  if(valid==="auto"){
    const expressive=/^(song|poem|lyrics|emotional)$/.test(genre);
    providers=expressive?["elevenlabs","edge","gemini","azure","sarvam"]:["edge","gemini","azure","sarvam"];
  }else if(valid==="elevenlabs"){
    providers=["elevenlabs","edge","gemini","azure","sarvam"];
  }else if(valid==="edge"){
    providers=["edge","gemini","azure","sarvam"];
  }else if(valid==="gemini"){
    providers=["gemini","edge","azure","sarvam"];
  }else if(valid==="azure"){
    providers=["azure","edge","gemini","sarvam"];
  }else{
    providers=["sarvam","edge","gemini","azure"];
  }
  const attempted=[];
  for(const provider of providers){
    const result=await synthesizeWithProvider(provider,chunks,body,env);
    attempted.push({provider,ok:!!result.ok,model:result.model||null,chunks:result.chunks||chunks.length,reason:result.ok?null:result.reason||null});
    if(result.ok)return reply({...result,attempted},200);
  }
  return reply({error:"tts_provider_failed",free_first:true,paid_fallback_enabled:String(env.ELEVENLABS_ALLOW_PAID||"false").toLowerCase()==="true",chunks:chunks.length,attempted},502);
}


async function callGemini(env, model, body){
  const upstream=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent",{
    method:"POST",
    headers:{"content-type":"application/json","x-goog-api-key":env.GEMINI_API_KEY},
    body:JSON.stringify(body)
  });
  const data=await upstream.json().catch(()=>({}));
  return {upstream,data,model};
}

function bytesToBase64(bytes){
  let binary="";
  const chunk=0x8000;
  for(let i=0;i<bytes.length;i+=chunk){
    binary+=String.fromCharCode(...bytes.subarray(i,i+chunk));
  }
  return btoa(binary);
}

function nearestProviderRatio(ratio){
  const parts=String(ratio||"1:1").split(":").map(Number),target=(parts[0]||1)/(parts[1]||1);
  const supported=["1:1","3:2","2:3","4:3","3:4","16:9","9:16","4:5","5:4","21:9"];
  let best="1:1",delta=Infinity;
  for(const r of supported){const p=r.split(":").map(Number),d=Math.abs(Math.log(target/(p[0]/p[1])));if(d<delta){delta=d;best=r;}}
  return best;
}
function simplifyImageRatio(w,h){let a=w,b=h;while(b){const t=b;b=a%b;a=t;}return (w/a)+":"+(h/a);}

function parseImageSpec(prompt){
  const original=String(prompt||"");
  const p=original.toLowerCase();
  const dimMatch=original.match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/i);
  const ratioMatch=original.match(/(\d{1,2})\s*:\s*(\d{1,2})/);
  const hasExplicitDimensions=!!dimMatch;
  const hasExplicitRatio=!!ratioMatch;
  let width=0,height=0,ratio="1:1",intent="general";
  const isShort=/youtube\s*shorts|shorts|tiktok|tik tok|reels|reel|vertical video|টিকটক|রিলস|শর্টস/i.test(p);
  const isYouTube=/youtube|ইউটিউব|thumbnail|থাম্বনেইল/i.test(p);
  const isInstagram=/instagram|ইনস্টাগ্রাম/i.test(p);
  const isFacebook=/facebook|ফেসবুক/i.test(p);
  const isIcon=/icon|আইকন|favicon/i.test(p);
  const isWebsite=/website|web image|web graphic|ওয়েবসাইট|ওয়েবসাইট/i.test(p);
  if(isShort){ratio="9:16";intent="short-video";}
  else if(isYouTube){ratio="16:9";intent="youtube";}
  else if(isInstagram){ratio=/portrait|vertical|4\s*:\s*5|পোর্ট্রেট|লম্বা/i.test(p)?"4:5":"1:1";intent="instagram";}
  else if(isFacebook){ratio=/portrait|vertical|পোর্ট্রেট|লম্বা/i.test(p)?"4:5":"16:9";intent="facebook";}
  else if(isIcon){ratio="1:1";intent="icon";}
  else if(isWebsite){ratio="3:2";intent="web";}
  if(hasExplicitRatio){
    const rw=Number(ratioMatch[1]),rh=Number(ratioMatch[2]);
    if(rw>0&&rh>0&&rw<=100&&rh<=100)ratio=rw+":"+rh;
  }
  if(hasExplicitDimensions){
    width=Number(dimMatch[1]);height=Number(dimMatch[2]);
    if(width<1||height<1||width>8192||height>8192)throw new Error("invalid_image_dimensions");
    ratio=simplifyImageRatio(width,height);
  }
  const transparent=/transparent|transparency|স্বচ্ছ ব্যাকগ্রাউন্ড|স্বচ্ছ পটভূমি|ব্যাকগ্রাউন্ড ছাড়া|background\s*remove/i.test(p);
  const formatMatch=p.match(/\b(png|webp|jpe?g)\b/i);
  let format=formatMatch?(formatMatch[1].toLowerCase()==="jpg"?"image/jpeg":"image/"+formatMatch[1].toLowerCase()):"image/webp";
  if(transparent)format="image/png";
  const maxMatch=p.match(/(?:under|below|less than|maximum|max|সর্বোচ্চ|এর কম)\s*(\d+(?:\.\d+)?)\s*(kb|mb|কেবি|এমবি)/i);
  let maxBytes=null;
  if(maxMatch){const amount=Number(maxMatch[1]);const unit=maxMatch[2].toLowerCase();maxBytes=Math.floor(amount*(unit==="kb"||unit==="কেবি"?1000:1000000));}
  else if(/under\s*1\s*mb|less than\s*1\s*mb|১\s*এমবি.?র কম|১\s*এমবি এর কম/i.test(p))maxBytes=1000000;
  let quality="standard",longEdge=0;
  if(/4k|uhd|ultra\s*hd|৪কে/i.test(p)){quality="4K";longEdge=3840;}
  else if(/2k|qhd|quad\s*hd|২কে/i.test(p)){quality="2K";longEdge=2560;}
  else if(/full\s*hd|1080p|ফুল\s*এইচডি/i.test(p)){quality="Full HD";longEdge=1920;}
  else if(/\bhd\b|720p|এইচডি/i.test(p)){quality="HD";longEdge=1280;}
  if(!width||!height){
    const parts=ratio.split(":").map(Number),rw=parts[0]||1,rh=parts[1]||1;
    if(longEdge){
      const ratioValue=rw/rh;
      if(ratioValue>16/9){
        const targetHeight=quality==="4K"?2160:(quality==="2K"?1440:(quality==="Full HD"?1080:720));
        height=targetHeight;width=Math.max(1,Math.round(targetHeight*ratioValue));
      }else if(rw>=rh){width=longEdge;height=Math.max(1,Math.round(longEdge*rh/rw));}
      else{height=longEdge;width=Math.max(1,Math.round(longEdge*rw/rh));}
    }else if(intent==="youtube"){width=1280;height=720;}
    else if(intent==="short-video"){width=1080;height=1920;}
    else if(intent==="instagram"&&ratio==="4:5"){width=1080;height=1350;}
    else if(intent==="instagram"){width=1080;height=1080;}
    else if(intent==="facebook"&&ratio==="4:5"){width=1080;height=1350;}
    else if(intent==="facebook"){width=1200;height=675;}
    else if(intent==="icon"){width=512;height=512;}
    else if(intent==="web"){width=1200;height=800;}
    else {const base=1024;if(rw>=rh){width=base;height=Math.max(1,Math.round(base*rh/rw));}else{height=base;width=Math.max(1,Math.round(base*rw/rh));}}
  }
  const pixels=width*height;
  const imageSize=(Math.max(width,height)>=3500||quality==="4K")?"4K":(quality==="2K"||pixels>1800000||Math.max(width,height)>=2000)?"2K":"1K";
  return {intent,aspect_ratio:ratio,provider_aspect_ratio:nearestProviderRatio(ratio),width,height,format,transparent,max_bytes:maxBytes,quality,image_size:imageSize,explicit_dimensions:hasExplicitDimensions,explicit_ratio:hasExplicitRatio};
}

async function generateWithGemini(prompt,body,env){
  if(!env.GEMINI_API_KEY)return {ok:false,provider:"gemini",reason:"not_configured"};
  const preferred=env.GEMINI_IMAGE_MODEL ? [env.GEMINI_IMAGE_MODEL,...IMAGE_MODELS.filter(m=>m!==env.GEMINI_IMAGE_MODEL)] : IMAGE_MODELS;
  let last=null;
  for(const model of preferred){
    try{
      const upstream=await fetch("https://generativelanguage.googleapis.com/v1beta/interactions",{
        method:"POST",headers:{"content-type":"application/json","x-goog-api-key":env.GEMINI_API_KEY},
        body:JSON.stringify({model,input:prompt,response_format:{type:"image",mime_type:body.image_spec?.format==="image/png"?"image/png":"image/jpeg",aspect_ratio:String(body.image_spec?.provider_aspect_ratio||body.aspect_ratio||"1:1"),image_size:String(body.image_spec?.image_size||body.image_size||"1K")}})
      });
      const data=await upstream.json().catch(()=>({}));
      last={upstream,data,model};
      if(!upstream.ok){if([404,429,500,503].includes(upstream.status))continue;break;}
      const image=data?.output_image;
      if(image?.data)return {ok:true,provider:"gemini",model,mime_type:image.mime_type||"image/jpeg",image_data:image.data};
    }catch(e){last={error:String(e&&e.message||e)};}
  }
  return {ok:false,provider:"gemini",reason:last?.data?.error?.message||last?.error||"no_image_returned",status:last?.upstream?.status||null};
}

async function generateWithCloudflare(prompt,env,spec){
  if(!env.AI)return {ok:false,provider:"cloudflare-workers-ai",reason:"not_configured"};
  try{
    const model=env.CLOUDFLARE_IMAGE_MODEL||"@cf/black-forest-labs/flux-1-schnell";
    // Keep the user's prompt intact. Exact output ratio is enforced by the frontend
    // post-processor; adding generic composition text caused false NSFW rejections.
    const result=await env.AI.run(model,{prompt});
    const imageData=String(result?.image||"");
    if(!imageData)return {ok:false,provider:"cloudflare-workers-ai",model,reason:"empty_image"};
    return {ok:true,provider:"cloudflare-workers-ai",model,mime_type:"image/jpeg",image_data:imageData};
  }catch(e){
    return {ok:false,provider:"cloudflare-workers-ai",reason:String(e&&e.message||e)};
  }
}
async function generateImage(request,env){
  const body=await request.json();
  const prompt=String(body.prompt||"").trim();
  if(!prompt)return reply({error:"prompt_required"},400);
  if(prompt.length>12000)return reply({error:"prompt_too_large"},413);

  let image_spec;
  try{image_spec=parseImageSpec(prompt);}
  catch(e){return reply({error:"invalid_image_spec",message:String(e&&e.message||e)},400);}
  const generationPrompt=image_spec.transparent
    ? prompt+"\nOutput requirement: isolated subject on a genuinely transparent background with clean edges, if supported. Do not simulate transparency using a checkerboard."
    : prompt;
  const providerBody={...body,image_spec};
  const providers=env.IMAGE_PROVIDER_ORDER
    ? String(env.IMAGE_PROVIDER_ORDER).split(",").map(x=>x.trim()).filter(Boolean)
    : FREE_IMAGE_PROVIDERS;
  const attempted=[];
  for(const provider of providers){
    let result;
    if(provider==="gemini")result=await generateWithGemini(generationPrompt,providerBody,env);
    else if(provider==="cloudflare-workers-ai")result=await generateWithCloudflare(generationPrompt,env,image_spec);
    else continue;
    attempted.push({provider:result.provider,ok:!!result.ok,model:result.model||null,reason:result.ok?null:result.reason||null});
    if(result.ok)return reply({...result,attempted},200);
  }
  return reply({error:"image_provider_failed",free_first:true,image_spec,attempted},502);
}
async function transcribeAudio(request,env){
  const body=await request.json();
  const audio=String(body.audio_base64||"").replace(/^data:audio\/[^;]+;base64,/i,"");
  const mime=String(body.mime_type||"").split(";")[0].toLowerCase();
  const allowed=["audio/webm","audio/mp4","audio/ogg","audio/wav","audio/mpeg","audio/aac","audio/flac"];
  if(!audio||!allowed.includes(mime))return reply({error:"audio_and_supported_mime_type_required"},400);
  if(audio.length>18*1024*1024)return reply({error:"audio_too_large",max_bytes:12*1024*1024},413);
  if(!env.GEMINI_API_KEY)return reply({error:"transcription_provider_not_configured"},503);
  const language=String(body.language||"bn-BD").slice(0,20);
  const prompt="Transcribe the supplied audio verbatim. The audio may contain a person singing a song, not ordinary speech. Listen to the entire audio and use the surrounding lyrical context to resolve words where possible. Preserve the original language, Bengali regional pronunciation, wording, repetition, and line order; do not translate, summarize, rewrite, or invent missing lyrics. Add natural punctuation and line breaks based on meaning, phrasing, and pauses. For Bengali, use Bengali punctuation (।, , , ?). If a short part truly cannot be understood, mark only that part as [অস্পষ্ট]. Return only the transcription, with no preface or explanation. Audio language hint: "+language+".";
  const preferred=env.GEMINI_AUDIO_MODEL?[env.GEMINI_AUDIO_MODEL,"gemini-2.5-flash","gemini-2.0-flash"]:["gemini-2.5-flash","gemini-2.0-flash"];
  const attempted=[];
  for(const model of [...new Set(preferred)]){
    try{
      const r=await callGemini(env,model,{contents:[{parts:[{text:prompt},{inline_data:{mime_type:mime,data:audio}}]}],generationConfig:{temperature:0.1}});
      attempted.push({model,status:r.upstream.status});
      if(!r.upstream.ok){if([400,404,429,500,502,503].includes(r.upstream.status))continue;return reply({error:"audio_transcription_failed",provider_status:r.upstream.status},502);}
      const transcript=r.data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("\n").trim();
      if(transcript)return reply({ok:true,model,text:transcript},200);
    }catch(e){attempted.push({model,error:String(e&&e.message||e)});}
  }
  return reply({error:"audio_transcription_failed",attempted},502);
}

async function chat(request,env){
  const body=await request.json();
  const text=String(body.text||"").trim();
  if(!text)return reply({error:"text_required"},400);
  if(text.length>12000)return reply({error:"text_too_large"},413);
  if(!env.GEMINI_API_KEY)return reply({error:"chat_provider_not_configured"},503);
  const preferred=env.GEMINI_CHAT_MODEL? [env.GEMINI_CHAT_MODEL,...CHAT_MODELS.filter(m=>m!==env.GEMINI_CHAT_MODEL)] : CHAT_MODELS;
  const payload={contents:[{parts:[{text:"You are Mosharrof AI. Answer clearly and helpfully. Respond in Bengali when appropriate. Never claim an action you did not actually perform.\n\nUser:\n"+text}]}]};
  let last=null;
  for(const model of preferred){
    try{
      const r=await callGemini(env, model, payload);
      last=r;
      if(!r.upstream.ok){if([404,429,503,500].includes(r.upstream.status))continue;return reply({error:"chat_provider_failed",provider_status:r.upstream.status,provider_message:r.data?.error?.message||null,model},502);}
      const answer=r.data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("\n").trim();
      if(!answer)continue;
      return reply({ok:true,model,text:answer},200);
    }catch(e){last={error:String(e&&e.message||e)};continue;}
  }
  return reply({error:"chat_provider_failed",provider_status:last?.upstream?.status||null,provider_message:last?.data?.error?.message||last?.error||"all_models_failed",tried:preferred},502);
}

export default {async fetch(request,env){
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(request.method==="GET"&&new URL(request.url).pathname==="/health"){
    return reply({ok:true,service:"mosharrof-screenshot-analysis",gemini_configured:!!env.GEMINI_API_KEY,cloudflare_workers_ai_configured:!!env.AI,free_image_providers:FREE_IMAGE_PROVIDERS,tts_providers:["edge","elevenlabs","sarvam","browser"],edge_tts_configured:!!env.EDGE_TTS_API_URL,edge_tts_voice_configured:!!env.EDGE_TTS_VOICE,sarvam_configured:!!env.SARVAM_API_KEY,elevenlabs_configured:!!env.ELEVENLABS_API_KEY,elevenlabs_voice_configured:!!env.ELEVENLABS_VOICE_ID,elevenlabs_key_expiry_configured:!!env.ELEVENLABS_KEY_EXPIRES_AT,elevenlabs_key_expired:elevenLabsKeyExpired(env),paid_tts_enabled:String(env.ELEVENLABS_ALLOW_PAID||"false").toLowerCase()==="true",chat_models:CHAT_MODELS,vision_models:VISION_MODELS},200);
  }
  const origin=request.headers.get("Origin")||"";
  if(origin){
    let allowed=origin===ORIGIN;
    try{const u=new URL(origin);allowed=allowed||(u.protocol==="http:"&&(u.hostname==="localhost"||u.hostname==="127.0.0.1"));}catch{}
    if(!allowed)return reply({error:"origin_not_allowed",origin},403);
  }
  if(request.method!=="POST")return reply({error:"POST only"},405);
  try{
    const pathname=new URL(request.url).pathname;
    if(pathname==="/generate-image")return await generateImage(request,env);
    if(pathname==="/tts")return await tts(request,env);
    if(pathname==="/chat")return await chat(request,env);
    if(pathname==="/transcribe-audio")return await transcribeAudio(request,env);
    const body=await request.json();
    if(!body.image_base64||!String(body.mime_type||"").startsWith("image/"))return reply({error:"image_base64 and image/* mime_type are required"},400);
    if(String(body.image_base64).length>MAX_BYTES*1.4)return reply({error:"image_too_large"},413);
    if(!env.GEMINI_API_KEY)return reply({error:"analysis_provider_not_configured"},503);
    const preferred=env.GEMINI_VISION_MODEL?[env.GEMINI_VISION_MODEL,...VISION_MODELS]:VISION_MODELS;
    const prompt=body.prompt||"Analyze this screenshot in Bengali. Identify visible UI elements, layout, text, spacing, colors, errors, and actionable fixes. Separate observations from suggestions.";
    const payload={contents:[{parts:[{text:prompt},{inline_data:{mime_type:body.mime_type,data:body.image_base64}}]}]};
    for(const model of preferred){
      const r=await callGemini(env,model,payload);
      if(!r.upstream.ok)continue;
      const resultText=r.data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("\n").trim()||"No analysis returned.";
      return reply({ok:true,model,text:resultText},200);
    }
    return reply({error:"analysis_provider_failed"},502);
  }catch{return reply({error:"invalid_request"},400)}
}};
