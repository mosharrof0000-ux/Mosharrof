const registry={
  core:"coordination and governance",
  chat:"conversation interface",
  sidebar:"navigation and entity discovery",
  ui:"presentation and adaptive layout",
  voice:"context-aware smart voice input",
  storage:"file indexing and organization",
  tool_factory:"safe tool creation",
  quran_research:"Quran language research and evidence-based research workflows"
};
const out=document.querySelector("#console");
const form=document.querySelector("#chatForm");
const input=document.querySelector("#chatInput");
const voiceButton=document.querySelector("#voiceButton");
const voiceStatus=document.querySelector("#voiceStatus");

function smartPunctuation(text){
  text=text.trim().replace(/\s+/g," ");
  if(!text) return "";
  if(/[?!.।]$/.test(text)) return text;
  const q=/^(কি |কী |কেন |কিভাবে |কীভাবে |কখন |কোথায় |কোথায় |who |what |why |how |when |where |is |are |do |does |did )/i;
  return q.test(text) ? text+"?" : (/[ঀ-৿]/.test(text) ? text+"।" : text+".");
}
function contextualCorrection(text){
  return text
    .replace(/মোশারফ প্রজেক্টের/g,"মোশাররফ প্রজেক্টের")
    .replace(/মোশারফ প্রজেক্ট/g,"মোশাররফ প্রজেক্ট")
    .replace(/মোশারফ (AI|ai)/g,"মোশাররফ AI")
    .replace(/কোরান/g,"কুরআন")
    .replace(/কোরআন/g,"কুরআন")
    .replace(/করতেছি/g,"করছি")
    .replace(/করতেছেন/g,"করছেন");
}
function processVoiceText(text){ return smartPunctuation(contextualCorrection(text)); }
function renderRegistry(){
  out.textContent=Object.entries(registry).map(([id,res])=>id+" — "+res).join("\n");
}
renderRegistry();

form.addEventListener("submit",e=>{
  e.preventDefault();
  const value=input.value.trim();
  if(!value) return;
  out.textContent+="\n\nUser: "+value+"\nMosharrof Core: "+processVoiceText(value);
  input.value="";
});

const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
if(!SpeechRecognition){
  voiceButton.disabled=true;
  voiceStatus.textContent="Browser speech recognition is unavailable; text input remains available.";
}else{
  const recognition=new SpeechRecognition();
  recognition.lang="bn-BD";
  recognition.interimResults=true;
  recognition.continuous=false;
  recognition.onstart=()=>{voiceButton.disabled=true;voiceStatus.textContent="Listening…";};
  recognition.onresult=e=>{
    let text="";
    for(let i=e.resultIndex;i<e.results.length;i++) text+=e.results[i][0].transcript+" ";
    input.value=processVoiceText(text);
  };
  recognition.onerror=e=>{voiceStatus.textContent="Voice error: "+e.error;};
  recognition.onend=()=>{voiceButton.disabled=false;voiceStatus.textContent="Voice input ready.";};
  voiceButton.addEventListener("click",()=>recognition.start());
}