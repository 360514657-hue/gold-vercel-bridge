import test from 'node:test';import assert from 'node:assert/strict';
import proxy from '../api/[...path].js';import {endpoint} from '../services/http.js';
import {MemoryStore,RedisStore} from '../state/store.js';
import {signal} from '../services/signal.js';
function response(){return {headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},status(n){this.code=n;return this;},json(x){this.body=x;return this;},send(x){this.body=x;return this;},end(){this.ended=true;return this;}};}
test('all four existing paths preserve status, payload and duplicate query parameters',async()=>{
  const old=global.fetch;
  try{for(const path of ['quote','bars','calendar','flash']){
    let target;global.fetch=async(url,opts)=>{target=url;assert.equal(opts.method,'GET');return new Response('{"unchanged":true}',{status:206,headers:{'content-type':'application/custom'}});};
    const res=response();await proxy({method:'GET',headers:{host:'bridge.test'},url:`/api/${path}?a=1&a=2&keyword=%E9%BB%84%E9%87%91`},res);
    assert.equal(target,`https://gold.360514657.workers.dev/${path}?a=1&a=2&keyword=%E9%BB%84%E9%87%91`);assert.equal(res.code,206);assert.equal(res.body,'{"unchanged":true}');assert.equal(res.headers['content-type'],'application/custom');
  }}finally{global.fetch=old;}
});
test('existing OPTIONS, missing path, non-GET and upstream error behavior retained',async()=>{
  const opts=response();await proxy({method:'OPTIONS'},opts);assert.equal(opts.code,204);
  const post=response();await proxy({method:'POST'},post);assert.equal(post.code,405);
  const missing=response();await proxy({method:'GET',headers:{host:'x'},url:'/api/'},missing);assert.equal(missing.code,400);
  const old=global.fetch;try{global.fetch=async()=>{throw Error('fixture')};const r=response();await proxy({method:'GET',headers:{host:'x'},url:'/api/quote'},r);assert.equal(r.code,500);assert.equal(r.body.error,'fixture');}finally{global.fetch=old;}
});
test('new endpoints redact internal exceptions and never return allow on errors',async()=>{const r=response();await endpoint('signal',{run:async()=>{throw Error('SECRET')}})({method:'GET'},r);assert.equal(r.code,503);assert.equal(r.body.action,'NO_TRADE');assert.ok(!JSON.stringify(r.body).includes('SECRET'));});
test('scanner is compact and all views share the same service',async()=>{const r=response();await endpoint('scanner',{run:async()=>({price:110,rating:'B',action:'OBSERVE',model:'V1',bias:'LONG',entry:{low:109,high:110},stop_loss:108,tp1:115,tp2:120})})({method:'GET'},r);assert.equal(r.body.direction,'BUY');assert.equal(r.body.entry,'109-110');});
test('CAS rejects concurrent stale writes',async()=>{const s=new MemoryStore();assert.equal(s.durable,false);assert.equal(await s.compareAndSet(null,'one'),true);assert.equal(await s.compareAndSet(null,'two'),false);assert.equal(await s.read(),'one');});
test('Redis adapter uses atomic CAS and does not expose token errors',async()=>{const calls=[];const s=new RedisStore('https://state.test','fake',{fetcher:async(u,o)=>{calls.push(JSON.parse(o.body));return {ok:true,json:async()=>({result:calls.length===1?null:1})};}});assert.equal(await s.read(),null);assert.equal(await s.compareAndSet(null,'state'),true);assert.equal(calls[1][0],'EVAL');assert.equal(s.durable,true);});
test('identical snapshots across API views reuse committed state without a second write',async()=>{
  const repository=new MemoryStore();let writes=0;const cas=repository.compareAndSet.bind(repository);repository.compareAndSet=async(...args)=>{writes++;return cas(...args);};
  const input={now:1000000,quote:{price:100,at:1000000,fresh:true},m5:{valid:[],quality:'MISSING',flags:[]},m15:{valid:[],quality:'MISSING',flags:[]},calendar:{ok:true,data:[]},flashes:[{ok:true,data:[]}],source_errors:[]};
  const loader=async()=>structuredClone(input);
  const a=await signal({repository,loader}),b=await signal({repository,loader});assert.deepEqual(a,b);assert.equal(writes,1);
});
