export async function runSelectedChat(body,env,report,fallbackText,targetWords,maxOutputTokens,deps){
  const {CHAT_MODELS,buildReflectiveUserPrompt,callGemini,LONG_CHAT_PROVIDER_TIMEOUT_MS,CHAT_PROVIDER_TIMEOUT_MS,buildReflectiveSystemPrompt,withChatProviderTimeout,generateWithOpenAICompatibleChat,outputTokenBudget}=deps;
  const provider=String(body.provider||"auto").toLowerCase();
  if(provider==="auto")return null;
  const requested=String(body.model||"").trim();
  const attempted=[];
  if(provider==="gemini"){
    if(requested&& !CHAT_MODELS.includes(requested))return {status:400,data:{error:"unsupported_manual_model",provider,model:requested,attempted:[]}};
    const model=requested||CHAT_MODELS[0];
    const keys=[env.GEMINI_API_KEY,env.GEMINI_API_KEY_2,env.GEMINI_API_KEY_3,env.GEMINI_API_KEY_4,env.GEMINI_API_KEY_5].map(x=>String(x||"").trim()).filter(Boolean);
    if(!keys.length)return {status:503,data:{error:"provider_not_configured",provider,model,attempted:[{provider,model,reason:"not_configured"}]}};
    const payload={contents:[{parts:[{text:buildReflectiveUserPrompt(fallbackText,{targetWords})}]}]};
    if(targetWords)payload.generationConfig={temperature:0.3,maxOutputTokens};
    for(const key of keys){
      report({stage:"trying",provider,model});
      try{
        const r=await callGemini(env,model,payload,key,targetWords>1000?LONG_CHAT_PROVIDER_TIMEOUT_MS:CHAT_PROVIDER_TIMEOUT_MS);
        if(!r.upstream.ok){attempted.push({provider,model,status:r.upstream.status,reason:r.data?.error?.message||("HTTP "+r.upstream.status)});report({stage:"failed",provider,model});continue;}
        const answer=r.data?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("\n").trim();
        if(answer){report({stage:"answered",provider,model});return {status:200,data:{ok:true,provider,model,text:answer,attempted:[{provider,model,ok:true}],...(targetWords?{requested_words:targetWords,output_token_budget:maxOutputTokens}:{})}};}
        attempted.push({provider,model,reason:"empty_response"});report({stage:"failed",provider,model});
      }catch(e){attempted.push({provider,model,reason:String(e&&e.message||e)});report({stage:"failed",provider,model});}
    }
  }else if(provider==="cloudflare-workers-ai"){
    const configured=String(env.CLOUDFLARE_CHAT_MODELS||env.CLOUDFLARE_CHAT_MODEL||"@cf/zai-org/glm-4.7-flash,@cf/meta/llama-3.3-70b-instruct-fp8-fast").split(",").map(x=>x.trim()).filter(Boolean);
    if(requested&&!configured.includes(requested))return {status:400,data:{error:"manual_model_not_configured",provider,model:requested,configured_models:configured,attempted:[]}};
    const model=requested||configured[0];
    if(!env.AI)return {status:503,data:{error:"provider_not_configured",provider,model,attempted:[{provider,model,reason:"not_configured"}]}};
    report({stage:"trying",provider,model});
    try{
      const result=await withChatProviderTimeout(env.AI.run(model,{messages:[{role:"system",content:buildReflectiveSystemPrompt()},{role:"user",content:fallbackText}],max_tokens:targetWords?Math.min(8192,outputTokenBudget(targetWords)):1024,temperature:0.3}),targetWords>1000?LONG_CHAT_PROVIDER_TIMEOUT_MS:CHAT_PROVIDER_TIMEOUT_MS,"manual_cloudflare_workers_ai");
      const answer=String(result?.response||result?.choices?.[0]?.message?.content||"").trim();
      if(answer){report({stage:"answered",provider,model});return {status:200,data:{ok:true,provider,model,text:answer,attempted:[{provider,model,ok:true}],...(targetWords?{requested_words:targetWords,output_token_budget:maxOutputTokens}:{})}};}
      attempted.push({provider,model,reason:"empty_response"});report({stage:"failed",provider,model});
    }catch(e){attempted.push({provider,model,reason:String(e&&e.message||e)});report({stage:"failed",provider,model});}
  }else if(provider==="groq"){
    const model=String(requested||env.GROQ_CHAT_MODEL||"llama-3.1-8b-instant").slice(0,160);
    if(!env.GROQ_API_KEY)return {status:503,data:{error:"provider_not_configured",provider,model,attempted:[{provider,model,reason:"not_configured"}]}};
    const result=await generateWithOpenAICompatibleChat(provider,"https://api.groq.com/openai/v1/chat/completions",String(env.GROQ_API_KEY||"").trim(),model,fallbackText,{},report,targetWords);
    attempted.push({provider,model:result.model||model,status:result.status||null,reason:result.ok?null:result.reason||"failed"});
    if(result.ok)return {status:200,data:{ok:true,provider,model:result.model,text:result.text,attempted,...(targetWords?{requested_words:targetWords,output_token_budget:maxOutputTokens}:{})}};
  }else if(provider==="openrouter"){
    const model=String(requested||env.OPENROUTER_CHAT_MODEL||"meta-llama/llama-3.3-70b-instruct:free").slice(0,180);
    if(!env.OPENROUTER_API_KEY)return {status:503,data:{error:"provider_not_configured",provider,model,attempted:[{provider,model,reason:"not_configured"}]}};
    const result=await generateWithOpenAICompatibleChat(provider,"https://openrouter.ai/api/v1/chat/completions",String(env.OPENROUTER_API_KEY||"").trim(),model,fallbackText,{"HTTP-Referer":"https://mosharrof0000-ux.github.io/Mosharrof/","X-Title":"MOSHARROF AI"},report,targetWords);
    attempted.push({provider,model:result.model||model,status:result.status||null,reason:result.ok?null:result.reason||"failed"});
    if(result.ok)return {status:200,data:{ok:true,provider,model:result.model,text:result.text,attempted,...(targetWords?{requested_words:targetWords,output_token_budget:maxOutputTokens}:{})}};
  }else return {status:400,data:{error:"unsupported_manual_provider",provider,attempted:[]}};
  return {status:502,data:{error:"selected_provider_failed",message:"The manually selected provider failed; automatic fallback was not used.",provider,attempted,manual_selection:true}};
}
