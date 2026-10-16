/* Explicit word-count parsing and output-budget policy shared by chat providers. */
export function requestedWordCount(value){
  const text=String(value||"").replace(/[০-৯]/g,d=>String("০১২৩৪৫৬৭৮৯".indexOf(d))).replace(/,/g,"");
  const unit="(?:words?|শব্দ|ওয়ার্ড|ওয়ার্ড)(?:ের|এর|ে)?";
  const patterns=[
    new RegExp("(\\\\d{1,6})\\\\s*(?:-|\\\\s)?"+unit,"i"),
    new RegExp("(\\\\d{1,3})\\\\s*(?:thousand|k)\\\\s*"+unit,"i"),
    new RegExp("(\\\\d{1,3})\\\\s*হাজার\\\\s*"+unit,"i"),
    new RegExp("(\\\\d{1,6})\\\\s*[- ]?"+unit+"\\\\s*(?:long|লম্বা|দীর্ঘ)","i")
  ];
  for(const pattern of patterns){
    const match=text.match(pattern);
    if(!match)continue;
    let count=Number(match[1]);
    if(/thousand|k|হাজার/i.test(match[0]))count*=1000;
    if(Number.isFinite(count)&&count>0)return Math.min(20000,Math.floor(count));
  }
  return 0;
}
export function outputTokenBudget(words){
  return words>0?Math.min(65536,Math.max(2048,Math.ceil(words*3.1)+512)):0;
}
