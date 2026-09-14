import {timestamp} from '../jin10.js';
export async function probeBars(mapping,{fetcher=fetch,now=Date.now()}={}){
 const result={};
 for(const [key,entry] of Object.entries(mapping)){
 result[key]={};for(const [tf,minutes] of [['M1',1],['M5',5],['M15',15]]){
 if(!entry.internal_code||entry.status!=='FOUND'){result[key][tf]='NOT_TESTED_CODE_UNRESOLVED';continue;}
 const url=new URL(tf==='M1'?'https://gold.360514657.workers.dev/kline':'https://gold.360514657.workers.dev/bars');url.searchParams.set('code',entry.internal_code);url.searchParams.set('count','30');if(tf==='M1')url.searchParams.set('time',String(Math.floor(now/1000)));else url.searchParams.set('tf',tf);
 try{const r=await fetcher(url,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();const raw=await r.json(),d=raw.data,rows=tf==='M1'?d?.klines:d?.bars;
 const valid=raw.ok===true&&d?.code===entry.internal_code&&Array.isArray(rows)&&rows.length>=2&&(tf==='M1'||d.timeframe===tf);
 if(!valid){result[key][tf]='RESPONSE_NOT_VALIDATED';continue;}
 const times=rows.map(b=>timestamp(b.time_epoch??b.time));const shape=rows.every((b,i)=>{const [o,h,l,c]=['open','high','low','close'].map(k=>Number(b[k]));return [o,h,l,c].every(x=>Number.isFinite(x)&&x>0)&&h>=Math.max(o,l,c)&&l<=Math.min(o,h,c)&&Number.isFinite(times[i])&&times[i]<=now&&(tf==='M1'||b.complete===true&&b.m1_count===minutes);});
 result[key][tf]=shape&&times.slice(1).every((t,i)=>t-times[i]===minutes*60000)?'VERIFIED_SAMPLE':'GAPS_OR_INCOMPLETE_SAMPLE';
 }catch{result[key][tf]='REQUEST_FAILED';}
 }
 }return result;
}
