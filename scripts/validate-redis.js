import {RedisStore} from '../state/store.js';
import {randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;
if(!url||!token){console.log(JSON.stringify({status:'NOT_RUN',reason:'UPSTASH_ENV_REQUIRED'}));process.exit(2);}
if(process.env.REDIS_VALIDATION_CHILD){try{const r=new RedisStore(url,token,{key:process.env.REDIS_VALIDATION_CHILD});process.stdout.write((await r.read())==='revision-2'?'PASS':'FAIL');}catch{process.stdout.write('FAIL');}process.exit();}
const key='gold:validation:'+randomUUID(),a=new RedisStore(url,token,{key}),b=new RedisStore(url,token,{key});
try{
 const write=await a.compareAndSet(null,'revision-1'),next_request=await a.read()==='revision-1',multi_instance=await b.read()==='revision-1';
 const update=await b.compareAndSet('revision-1','revision-2'),stale_rejected=!(await a.compareAndSet('revision-1','stale'));
 const child=spawnSync(process.execPath,[import.meta.filename],{env:{...process.env,REDIS_VALIDATION_CHILD:key},encoding:'utf8',timeout:15000,windowsHide:true});
 const cold_process=child.status===0&&child.stdout==='PASS';
 const pass=write&&next_request&&multi_instance&&update&&stale_rejected&&cold_process;
 console.log(JSON.stringify({status:pass?'PASS':'FAIL',write,next_request,multi_instance,stale_rejected,cold_process,vercel_cold_start:'NOT_TESTED'}));if(!pass)process.exitCode=1;
}catch{console.log(JSON.stringify({status:'FAIL',reason:'REDIS_TECHNICAL_FAILURE'}));process.exitCode=1;}
finally{try{await a.command(['DEL',key]);}catch{console.log(JSON.stringify({cleanup:'FAILED',test_key:key}));process.exitCode=1;}}
