const registry={core:"coordination and governance",chat:"conversation interface",sidebar:"navigation and entity discovery",ui:"adaptive presentation and accessibility",voice:"context-aware voice processing",storage:"file indexing and authorized organization",tool_factory:"safe tool creation and execution",quran_research:"Quran language research and evidence-based research workflows"};
const out=document.querySelector("#console");
const form=document.querySelector("#chatForm");
const input=document.querySelector("#chatInput");
const voiceButton=document.querySelector("#voiceButton");

function correctContext(text){
  return text
    .replace(/(^|\s)কোরান(?=\s|$)/g,"$1কুরআন")
    .replace(/(^|\s)কোরআন(?=\s|$)/g,"$1কুরআন")
    .replace(/(^|\s)কুরান(?=\s|$)/g,"$1কুরআন")
    .replace(/(^|\s)মশাররফ(?=\s|$)/g,"$1মোশাররফ");
}

function smartPunctuation(text){
  let value=text.replace(/\s+/g," ").trim();
  if(!value)return "";
  if(/[.!?।]$/.test(value))return value;
  const first=(value.split(/\s+/)[0]||"").toLowerCase();
  const questionStarters=["কি","কী","কেন","কিভাবে","কীভাবে","কোথায়","কোথায়","কখন","কে","what","why","how","where","when","who"];
  return value+(questionStarters.includes(first)?"?":"।");
}

function renderRegistry(){
  out.textContent=Object.entries(registry).map(([id,res])=>id+" — "+res).join("\n");
}
renderRegistry();

form.addEventListener("submit",e=>{
  e.preventDefault();
  const value=input.value.trim();
  if(!value)return;
  const cleaned=smartPunctuation(correctContext(value));
  out.textContent+="\n\nUser: "+cleaned+"\nMosharrof Core: Foundation UI is online. A model adapter is not connected in this static Pages build yet.";
  input.value="";
});

if("webkitSpeechRecognition" in window || "SpeechRecognition" in window){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const recognition=new SpeechRecognition();
  recognition.lang="bn-BD";
  recognition.interimResults=true;
  recognition.continuous=false;

  voiceButton.addEventListener("click",()=>{
    recognition.start();
    voiceButton.textContent="🎙 Listening…";
    voiceButton.setAttribute("aria-busy","true");
  });

  recognition.onresult=(event)=>{
    let transcript="";
    for(let i=event.resultIndex;i<event.results.length;i++) transcript+=event.results[i][0].transcript;
    input.value=smartPunctuation(correctContext(transcript));
  };
  recognition.onerror=()=>{voiceButton.textContent="🎙 Voice";voiceButton.removeAttribute("aria-busy");};
  recognition.onend=()=>{voiceButton.textContent="🎙 Voice";voiceButton.removeAttribute("aria-busy");};
}else{
  voiceButton.addEventListener("click",()=>{
    out.textContent+="\n\nVoice input: This browser does not expose SpeechRecognition. Use a supported browser or connect an STT provider.";
  });
}
