const ORIGIN="https://mosharrof0000-ux.github.io";
const MAX_BYTES=12*1024*1024;
const headers={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"content-type","Vary":"Origin"};
function reply(data,status){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8",...headers}})}

async function chat(request,env){
  const body=await request.json();
  const text=String(body.text||"").trim();
  if(!text)return reply({error:"text_required"},400);
  if(text.length>12000)return reply({error:"text_too_large"},413);
  if(!env.GEMINI_API_KEY)return reply({error:"chat_provider_not_configured"},503);
  const model=env.GEMINI_CHAT_MODEL||"gemini-3.6-flash";
  const upstream=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent",{method:"POST",headers:{"content-type":"application/json","x-goog-api-key":env.GEMINI_API_KEY},body:JSON.stringify({contents:[{parts:[{text:"You are Mosharrof AI. Answer clearly and helpfully. Respond in Bengali when appropriate. Never claim an action you did not actually perform.\n\nUser:\n"+text}]}]})});
  const data=await upstream.json().catch(()=>({}));
  if(!upstream.ok)return reply({error:"chat_provider_failed",provider_status:upstream.status,provider_message:data?.error?.message||null},502);
  const answer=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("\n").trim();
  if(!answer)return reply({error:"empty_model_response"},502);
  return reply({ok:true,model,text:answer},200);
}

export default {async fetch(request,env){
  if(request.method==="OPTIONS")return new Response(null,{status:204,headers});
  if(request.method==="GET"&&new URL(request.url).pathname==="/health")return reply({ok:true,service:"mosharrof-screenshot-analysis",gemini_configured:!!env.GEMINI_API_KEY,chat_model:env.GEMINI_CHAT_MODEL||"gemini-3.6-flash",vision_model:env.GEMINI_VISION_MODEL||"gemini-3.8-flash"},200);
  const origin=request.headers.get("Origin")||"";
  if(origin&&origin!==ORIGIN)return reply({error:"origin_not_allowed"},403);
  if(request.method!=="POST")return reply({error:"POST only"},405);
  try{
    if(new URL(request.url).pathname==="/chat")return await chat(request,env);
    const body=await request.json();
    if(!body.image_base64||!String(body.mime_type||"").startsWith("image/"))return reply({error:"image_base64 and image/* mime_type are required"},400);
    if(String(body.image_base64).length>MAX_BYTES*1.4)return reply({error:"image_too_large"},413);
    if(!env.GEMINI_API_KEY)return reply({error:"analysis_provider_not_configured"},503);
    const model=env.GEMINI_VISION_MODEL||"gemini-3.8-flash";
    const prompt=body.prompt||"Analyze this screenshot in Bengali. Identify visible UI elements, layout, text, spacing, colors, errors, and actionable fixes. Separate observations from suggestions.";
    const upstream=await fetch("https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent",{method:"POST",headers:{"content-type":"application/json","x-goog-api-key":env.GEMINI_API_KEY},body:JSON.stringify({contents:[{parts:[{text:prompt},{inline_data:{mime_type:body.mime_type,data:body.image_base64}}]}]})});
    const data=await upstream.json();
    if(!upstream.ok)return reply({error:"analysis_provider_failed"},502);
    const resultText=data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("\n").trim()||"No analysis returned.";
    return reply({ok:true,model,text:resultText},200);
  }catch{return reply({error:"invalid_request"},400)}
}};