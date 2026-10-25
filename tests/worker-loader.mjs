import{readFile}from"node:fs/promises";
export async function loadWorker(){
const p=["worker/screenshot-analysis.js","core/chat-context.js","core/reflective-chat-prompt.js","core/reflective-intelligence-rules.js","core/chat-provider-retry.js","core/image-spec.js","core/manual-chat-routing.js"],v=await Promise.all(p.map(x=>readFile(new URL("../"+x,import.meta.url),"utf8"))),[s,c,r,g,t,i,m]=v;
const rWithRules=r.replace('import { REFLECTIVE_INTELLIGENCE_RULES } from "./reflective-intelligence-rules.js";',g);
const q=m.replace(/^import .*\n/gm,"").replace("export const CHAT_MODELS","const CHAT_MODELS").replace("export async function runSelectedChat","async function runSelectedChat").replace(/function outputTokenBudget\(words\)\{[^}]*\}\n/,"");
const w=s.replace('import { buildChatContext } from "../core/chat-context.js";',c).replace('import { buildReflectiveSystemPrompt, buildReflectiveUserPrompt } from "../core/reflective-chat-prompt.js";',rWithRules).replace('import { runChatUntilAnswer, withChatProviderTimeout } from "../core/chat-provider-retry.js";',t).replace('import { parseImageSpec } from "../core/image-spec.js";',i).replace('import { CHAT_MODELS, runSelectedChat } from "../core/manual-chat-routing.js";',q);
return(await import("data:text/javascript;base64,"+Buffer.from(w).toString("base64"))).default
}