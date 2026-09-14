import {loadFredDaily} from './providers/fred.js';
import {ms,policy} from '../config/policy.js';
export const ORIGIN='https://gold.360514657.workers.dev';
export function number(x){return x===null || x===undefined || x==='' ? null : Number.isFinite(Number(x))?Number(x):null;}
export function timestamp(x){
  if(typeof x==='number')return x<1e12?x*1000:x;
  if(typeof x!=='string')return NaN;
  if(/^\d{10}(?:\d{3})?$/.test(x))return timestamp(Number(x));
  if(!/^\d{4}-\d\d-\d\d \d\d:\d\d(?::\d\d)?$/.test(x)&&!/(Z|[+-]\d\d:\d\d)$/.test(x))return NaN;
  // Bridge calendar timestamps without an offset are explicitly Beijing time.
  return Date.parse(/^\d{4}-\d\d-\d\d \d\d:\d\d(?::\d\d)?$/.test(x)?x.replace(' ','T')+'+08:00':x);
}
export function quote(raw,now){
  const d=raw?.data??{},time=timestamp(raw?.freshness?.quote_time??d.time),price=number(d.close??d.price);
  const valid=raw?.ok===true && d.code==='XAUUSD' && price>0 && Number.isFinite(time) && time<=now;
  return {price,at:Number.isFinite(time)?time:null,fresh:valid && now-time<=policy.quoteMaxAgeMs && raw?.freshness?.stale!==true,
    day_open:number(d.open),day_high:number(d.high),day_low:number(d.low),basis:'JIN10_INDICATIVE_CLOSE',bid:number(d.bid),ask:number(d.ask)};
}
export function bars(raw,tf,now){
  const flags=[],rows=raw?.data?.bars,seen=new Map(),rejected=[];
  if(raw?.ok!==true || raw?.data?.code!=='XAUUSD' || raw?.data?.timeframe!==tf || !Array.isArray(rows))return {valid:[],reference:[],quality:'MISSING',flags:['INVALID_BAR_RESPONSE']};
  let last=-Infinity;
  for(const r of rows){
    const at=timestamp(r.time_epoch??r.time),b={at,end:at+ms[tf],tf,...Object.fromEntries(['open','high','low','close'].map(k=>[k,number(r[k])]))};
    if(at<last)flags.push('OUT_OF_ORDER');last=at;
    if(seen.has(at)){seen.set(at,null);flags.push('DUPLICATE_TIMESTAMP');continue;}
    const shape=Number.isFinite(at)&&at%ms[tf]===0&&[b.open,b.high,b.low,b.close].every(x=>x>0)&&b.high>=Math.max(b.open,b.close,b.low)&&b.low<=Math.min(b.open,b.close);
    if(!shape || b.end>now || r.complete!==true || r.m1_count!==ms[tf]/60000){rejected.push(b);flags.push(!shape?'INVALID_OHLC':b.end>now?'UNCLOSED_BAR':'INCOMPLETE_M1');seen.set(at,null);continue;}
    seen.set(at,b);
  }
  const valid=[...seen.values()].filter(Boolean).sort((a,b)=>a.at-b.at);
  if(valid.some((b,i)=>i&&b.at!==valid[i-1].end))flags.push('GAPS');
  if(!valid.length || now-valid.at(-1).end>2*ms[tf])flags.push('STALE_BARS');
  return {valid,reference:rejected,quality:valid.length===0?'MISSING':flags.length?'PARTIAL':'GOOD',flags:[...new Set(flags)]};
}
export async function load({fetcher=fetch,now=Date.now(),origin=ORIGIN}={}){
  const paths={quote:'/quote?code=XAUUSD',m5:'/bars?code=XAUUSD&tf=M5&count=30',m15:'/bars?code=XAUUSD&tf=M15&count=20',calendar:'/calendar',gold:'/flash?keyword=%E9%BB%84%E9%87%91',fed:'/flash?keyword=%E7%BE%8E%E8%81%94%E5%82%A8'};
  const values=await Promise.all(Object.entries(paths).map(async([k,p])=>{try{const r=await fetcher(origin+p,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();return [k,await r.json()];}catch{return [k,null];}}));
  const raw=Object.fromEntries(values);
  const macro_facts=process.env.FRED_CONTEXT_ENABLED==='true'?await loadFredDaily({fetcher,now}):{};
  return {now,macro_facts,quote:quote(raw.quote,now),m5:bars(raw.m5,'M5',now),m15:bars(raw.m15,'M15',now),calendar:raw.calendar,flashes:[raw.gold,raw.fed],source_errors:values.filter(([,v])=>!v).map(([k])=>k)};
}
