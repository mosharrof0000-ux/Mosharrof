import fs from "node:fs";
const report={};
for(const name of ["mobile","desktop"]){
 const current=JSON.parse(fs.readFileSync("visual-inspection/"+name+".json","utf8"));
 const bp="visual-baselines/"+name+".json";
 if(fs.existsSync(bp)){
  const baseline=JSON.parse(fs.readFileSync(bp,"utf8"));
  report[name]={current,baseline,layoutChanged:current.width!==baseline.width||current.messageCount!==baseline.messageCount};
  if(report[name].layoutChanged) throw new Error(name+" layout regression detected");
 }else report[name]={current,baseline:"FIRST_RUN"};
}
fs.writeFileSync("visual-baseline-report.json",JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));