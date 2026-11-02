export const headers={"Access-Control-Allow-Origin":ORIGIN,"Access-Control-Allow-Methods":"POST, OPTIONS, GET","Access-Control-Allow-Headers":"content-type, authorization","Vary":"Origin"};
const TRUSTED_APP_ORIGINS=new Set([ORIGIN,"http://localhost","https://localhost","http://127.0.0.1","https://127.0.0.1","capacitor://localhost","ionic://localhost","https://appassets.androidplatform.net"]);
export function isAllowedOrigin(origin){
if(!origin)return true;
if(TRUSTED_APP_ORIGINS.has(origin))return true;
try{const u=new URL(origin);return u.protocol==="http:"&&(u.hostname==="localhost"||u.hostname==="127.0.0.1");}catch{return false;}
}
export function reply(data,status){return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8",...headers}})}
export function withRequestCors(response,request){
const origin=request.headers.get("Origin")||"";
const responseHeaders=new Headers(response.headers);
if(origin&&isAllowedOrigin(origin))responseHeaders.set("Access-Control-Allow-Origin",origin);
responseHeaders.set("Access-Control-Allow-Methods","POST, OPTIONS, GET");
responseHeaders.set("Access-Control-Allow-Headers","content-type, authorization");
responseHeaders.set("Vary","Origin");
return new Response(response.body,{status:response.status,statusText:response.statusText,headers:responseHeaders});
}
