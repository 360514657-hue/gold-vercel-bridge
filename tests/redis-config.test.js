import test from 'node:test';import assert from 'node:assert/strict';
import {redisConfig,createStore,MemoryStore,RedisStore} from '../state/store.js';
import {health} from '../services/health.js';import {endpoint} from '../services/http.js';import {signal} from '../services/signal.js';
const u={UPSTASH_REDIS_REST_URL:'https://upstash-fixture.invalid',UPSTASH_REDIS_REST_TOKEN:'upstash-fixture-token'},k={KV_REST_API_URL:'https://kv-fixture.invalid',KV_REST_API_TOKEN:'kv-fixture-token'};
test('UPSTASH pair selects UPSTASH',()=>{assert.deepEqual(redisConfig(u),{url:u.UPSTASH_REDIS_REST_URL,token:u.UPSTASH_REDIS_REST_TOKEN,source:'UPSTASH'});assert.ok(createStore(u) instanceof RedisStore);});
test('KV pair selects VERCEL_KV, including empty UPSTASH placeholders',()=>{assert.deepEqual(redisConfig(k),{url:k.KV_REST_API_URL,token:k.KV_REST_API_TOKEN,source:'VERCEL_KV'});assert.ok(createStore({...k,UPSTASH_REDIS_REST_URL:'',UPSTASH_REDIS_REST_TOKEN:''}) instanceof RedisStore);});
test('two complete pairs select UPSTASH',()=>assert.equal(redisConfig({...u,...k}).source,'UPSTASH'));
for(const [name,pair,other] of [['UPSTASH',u,k],['KV',k,u]])test(name+' partial pair fails even when other pair is complete',()=>{for(const key of Object.keys(pair))for(const rest of [{},other])assert.throws(()=>redisConfig({...rest,[key]:pair[key]}),{message:'INCOMPLETE_STATE_STORE_CONFIG'});});
test('no credentials preserve MemoryStore fallback',()=>{assert.equal(redisConfig({}),null);assert.ok(createStore({}) instanceof MemoryStore);assert.ok(createStore({UPSTASH_REDIS_REST_URL:'',UPSTASH_REDIS_REST_TOKEN:'',KV_REST_API_URL:'',KV_REST_API_TOKEN:''}) instanceof MemoryStore);});
function res(){return {setHeader(){},status(n){this.code=n;return this;},json(body){this.body=body;return this;}};}
for(const failure of [false,true])test('health/debug/logs redact configured URL and token on '+(failure?'failure':'success'),async()=>{
 for(const env of [u,k]){const logs=[];let stored=null;
 const repository=createStore(env,{fetcher:async()=>{if(failure)throw Error(Object.values(env).join(' '));return {ok:true,json:async()=>({result:stored})};}});
 repository.compareAndSet=async(before,after)=>{stored=after;return true;};
 const h=await health({repository,fetcher:async()=>{throw Error('offline');}});
 const input={now:1000000,quote:{price:100,at:1000000,fresh:true},m5:{valid:[],quality:'MISSING',flags:[]},m15:{valid:[],quality:'MISSING',flags:[]},calendar:{ok:true,data:[]},flashes:[{ok:true,data:[]}],source_errors:[]};
 const r=res();await endpoint('debug',{run:()=>signal({repository,loader:async()=>input,logger:x=>logs.push(x)})})({method:'GET'},r);
 assert.equal(r.code,failure?503:200);if(failure)assert.equal(r.body.action,'NO_TRADE');
 const serialized=JSON.stringify({health:h,debug:r.body,logs});for(const secret of Object.values(env))assert.ok(!serialized.includes(secret));
 }
});
