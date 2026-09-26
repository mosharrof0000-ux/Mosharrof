import fs from "node:fs";
const data=JSON.parse(fs.readFileSync("visual-qa/current.json","utf8"));
const text=data.bodyText||"";
for(const item of ["MOSHARROF","AI","আপনার প্রশ্ন লিখুন"]) if(!text.includes(item)) throw new Error("Visual/UI regression: missing required content: "+item);
const classes=data.elements.map(x=>String(x.selector));
for(const item of ["messages","composer"]) if(!classes.some(x=>x.includes(item))) throw new Error("Visual/UI regression: missing "+item);
console.log("Visual structural checks: PASS");
