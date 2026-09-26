const registry={
  core:"coordination and governance",
  chat:"conversation interface",
  sidebar:"navigation and entity discovery",
  ui:"presentation and adaptive layout",
  voice:"authorized voice input and text normalization",
  storage:"file indexing and authorized organization",
  tool_factory:"safe tool creation and execution",
  quran_research:"Quran language research and evidence-based research workflows"
};

const out=document.querySelector("#console");
const form=document.querySelector("#chatForm");
const input=document.querySelector("#chatInput");

function renderRegistry(){
  out.textContent="Mosharrof entity registry\n\n"+Object.entries(registry)
    .map(([id,res])=>id+" — "+res).join("\n");
}

renderRegistry();

form.addEventListener("submit",e=>{
  e.preventDefault();
  const value=input.value.trim();
  if(!value)return;
  out.textContent+="\n\nUser: "+value+
    "\nMosharrof Core: Static Pages interface is online. AI model adapter connection is not configured in this public build.";
  input.value="";
});
