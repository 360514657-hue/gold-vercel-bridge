import {createHash} from 'node:crypto';
export function stateKey(env=process.env){const scope=env.VERCEL_ENV??'local',branch=scope==='preview'?(env.VERCEL_GIT_COMMIT_REF??env.VERCEL_URL??'unlinked'):scope;return ['gold:jin10:xauusd:signal_rules_v2_first_retest:execution_v1',scope,createHash('sha256').update(branch).digest('hex').slice(0,12)].join(':');}
const CAS="local v=redis.call('GET',KEYS[1]); if (v or '')~=ARGV[1] then return 0 end; redis.call('SET',KEYS[1],ARGV[2],'EX',604800); return 1";
export class MemoryStore {
  constructor(){this.value=null;this.durable=false;}
  async read(){return this.value;}
  async compareAndSet(before,after){if(this.value!==before)return false;this.value=after;return true;}
}
export class RedisStore {
  constructor(url,token,{fetcher=fetch,key='gold:jin10:xauusd:signal_rules_v2_first_retest'}={}){
    if(new URL(url).protocol!=='https:')throw Error('STATE_STORE_HTTPS_REQUIRED');
    this.url=url;this.token=token;this.fetcher=fetcher;this.key=key;this.durable=true;
  }
  async command(command){
    const r=await this.fetcher(this.url,{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json'},body:JSON.stringify(command),signal:AbortSignal.timeout(5000)});
    if(!r.ok)throw Error('STATE_STORE_UNAVAILABLE');const x=await r.json();if(x.error)throw Error('STATE_STORE_ERROR');return x.result;
  }
  read(){return this.command(['GET',this.key]);}
  async compareAndSet(before,after){return await this.command(['EVAL',CAS,'1',this.key,before??'',after])===1;}
}
let singleton;
export function store(){
  if(!singleton){const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN;
    if(!!url!==!!token)throw Error('INCOMPLETE_STATE_STORE_CONFIG');singleton=url?new RedisStore(url,token,{key:stateKey()}):new MemoryStore();}
  return singleton;
}
