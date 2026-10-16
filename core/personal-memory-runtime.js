import {buildMemoryContext,createMemoryEntry,estimateResponseStyle,retrieveRelevantMemories} from "./personal-memory-engine.js";
import {countMemories,listMemories,saveConversationTurn,saveMemory} from "./personal-memory-store.js";
const CONSENT_KEY="mosharrof_memory_enabled_v1";
export function memoryEnabled(){try{return localStorage.getItem(CONSENT_KEY)!=="false"}catch{return true}}
export function setMemoryEnabled(enabled){try{localStorage.setItem(CONSENT_KEY,enabled?"true":"false")}catch{}return Boolean(enabled)}
export async function preparePersonalContext(text,history=[]){if(!memoryEnabled())return {context:"",style:estimateResponseStyle(text,history),memories:[],count:0};const entries=await listMemories({limit:5000});const found=retrieveRelevantMemories(entries,text);return {context:buildMemoryContext(found),style:estimateResponseStyle(text,history),memories:found.items,count:await countMemories()}}
export async function rememberTurn(userText,assistantText){if(!memoryEnabled())return 0;return (await saveConversationTurn({userText,assistantText})).length}
export async function rememberExplicitPreference(text){if(!memoryEnabled())return null;const entry=createMemoryEntry({text,role:"user",source:"explicit-preference",importance:1});if(entry)entry.kind="preference";return saveMemory(entry)}
