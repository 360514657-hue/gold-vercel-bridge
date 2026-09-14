const base=process.env.VALIDATION_BASE_URL;
if(!base){console.log('NOT_RUN: VALIDATION_BASE_URL required');process.exit(2);}
const checks=[];
for(const route of ['quote','bars','calendar','flash'])for(const [method,query] of [['GET','?code=XAUUSD'],['GET','?code=XAUUSD&code=XAUUSD'],['GET','?code=INVALID&tf=INVALID'],['OPTIONS',''],['POST','']])checks.push({path:'/api/'+route+query,method});
for(const route of ['signal/xauusd','scanner/xauusd','debug/xauusd','health/signal'])checks.push({path:'/api/'+route,method:'GET'});
for(const c of checks){try{const r=await fetch(new URL(c.path,base),{method:c.method,signal:AbortSignal.timeout(20000)});const text=await r.text();let body;try{body=JSON.parse(text);}catch{}console.log(JSON.stringify({...c,status:r.status,content_type:r.headers.get('content-type'),cors:r.headers.get('access-control-allow-origin'),fields:body?Object.keys(body):[],action:body?.action}));if(r.status>=500)process.exitCode=1;}catch{console.log(JSON.stringify({...c,status:'CONNECTION_FAILURE'}));process.exitCode=1;}}
console.log(JSON.stringify({compatibility:'REQUIRES_BASELINE_COMPARISON',forced_400_500:'NOT_INJECTED_ON_LIVE_UPSTREAM',cold_start:'REQUIRES_SEPARATE_VERCEL_INSTANCE_EVIDENCE'}));
