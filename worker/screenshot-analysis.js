const ORIGIN="https://mosharrof0000-ux.github.io";
const MAX_BYTES=12*1024*1024;
const headers={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Methods":"POST, OPTIONS, GET","Access-Control-Allow-Headers":"content-type","Vary":"Origin"};
function reply(data,status){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8",...headers}})}

const CHAT_MODELS=["gemini-2.0-flash","gemini-2.0-flash-001","gemini-1.5-flash","gemini-1.5-flash-latest","gemini-3.6-flash"];
const VISION_MODELS=["gemini-2.0-flash","gemini-1.5-flash","gemini-3.8-flash"];

async function callGemini(env, model, body){
  const upstream=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent",{
    method:"POST",
    headers:{"content-type":"application/json","x-goog-api-key":env.GEMINI_API_KEY},
    body:JSON.stringify(body)
  });
  const data=await upstream.json().catch(()=>({}));
  return {upstream, data, model};
}

async function chat(request,env){
  const body=await request.json();
  const text=String(body.text||"").trim();
  if(!text)return reply({error:"text_required"},400);
  if(text.length>12000)return reply({error:"text_too_large"},413);
  if(!env.GEMINI_API_KEY)return reply({error:"chat_provider_not_configured"},503);

  const preferred=env.GEMINI_CHAT_MODEL? [env.GEMINI_CHAT_MODEL, ...CHAT_MODELS.filter(m=>m!==env.GEMINI_CHAT_MODEL)] : CHAT_MODELS;
  const payload={contents:[{parts:[{text:"You are Mosharrof AI. Answer clearly and helpfully. Respond in Bengali when appropriate. Never claim an action you did not actually perform.\n\nUser:\n"+text}]}]};

  let last=null;
  for(const model of preferred){
    try{
      const r=await callGemini(env, model, payload);
      last=r;
      if(!r.upstream.ok){
        // try next model on 404/503/429
        if([404,429,503,500].includes(r.upstream.status)) continue;
        return reply({error:"chat_provider_failed",provider_status:r.upstream.status,provider_message:r.data?.error?.message||null,model},502);
      }
      const answer=r.data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("\n").trim();
      if(!answer) continue;
      return reply({ok:true,model,text:answer},200);
    }catch(e){
      last={error:String(e&&e.message||e)};
      continue;
    }
  }
  return reply({
    error:"chat_provider_failed",
    provider_status:last?.upstream?.status||null,
    provider_message:last?.data?.error?.message||last?.error||"all_models_failed",
    tried:preferred
  },502);
}

export default {async fetch(request,env){
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(request.method==="GET"&&new URL(request.url).pathname==="/health"){
    return reply({ok:true,service:"mosharrof-screenshot-analysis",gemini_configured:!!env.GEMINI_API_KEY,chat_models:CHAT_MODELS,vision_models:VISION_MODELS},200);
  }
  const origin=request.headers.get("Origin")||"";
  if(origin && origin!==ORIGIN && !origin.startsWith("http://localhost") && !origin.startsWith("http://127.0.0.1")){
    return reply({error:"origin_not_allowed",origin},403);
  }
  if(request.method!=="POST")return reply({error:"POST only"},405);
  try{
    if(new URL(request.url).pathname==="/chat")return await chat(request,env);
    const body=await request.json();
    if(!body.image_base64||!String(body.mime_type||"").startsWith("image/"))return reply({error:"image_base64 and image/* mime_type are required"},400);
    if(String(body.image_base64).length>MAX_BYTES*1.4)return reply({error:"image_too_large"},413);
    if(!env.GEMINI_API_KEY)return reply({error:"analysis_provider_not_configured"},503);
    const preferred=env.GEMINI_VISION_MODEL? [env.GEMINI_VISION_MODEL, ...VISION_MODELS] : VISION_MODELS;
    const prompt=body.prompt||"Analyze this screenshot in Bengali. Identify visible UI elements, layout, text, spacing, colors, errors, and actionable fixes. Separate observations from suggestions.";
    const payload={contents:[{parts:[{text:prompt},{inline_data:{mime_type:body.mime_type,data:body.image_base64}}]}]};
    for(const model of preferred){
      const r=await callGemini(env, model, payload);
      if(!r.upstream.ok) continue;
      const resultText=r.data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("\n").trim()||"No analysis returned.";
      return reply({ok:true,model,text:resultText},200);
    }
    return reply({error:"analysis_provider_failed"},502);
  }catch{return reply({error:"invalid_request"},400)}
}};
