import {macroFilterPolicy as p} from '../../config/macro-policy.js';
// Discovered and live-validated 2026-09-14: DXY / DXY / indices, GB. Never use production.
const base='https://api-free.itick.org/indices';
export function normalizeDxy(q,rows,now){
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const quoteOK=q?.s==='DXY'&&q?.r==='GB'&&finite(q.ld)&&q.ld>0&&finite(q.t)&&q.t<=now&&now-q.t<=p.quoteMaxAgeMs;
 const bars=Array.isArray(rows)?rows.filter(b=>finite(b.t)&&b.t+60000<=now).sort((a,b)=>a.t-b.t):[];
 const recent=bars.filter(b=>b.t+60000>=now-18*60000);
 const historyOK=recent.length>=16&&recent.every((b,i)=>[b.o,b.h,b.l,b.c].every(x=>finite(x)&&x>0)&&b.h>=Math.max(b.o,b.l,b.c)&&b.l<=Math.min(b.o,b.h,b.c)&&(!i||b.t-recent[i-1].t===60000));
 const end=recent.at(-1),ref=m=>recent.find(b=>b.t===end?.t-m*60000),r5=ref(5),r15=ref(15),fresh=!!quoteOK;
 const valid=fresh&&historyOK&&!!r5&&!!r15&&now-(end.t+60000)<=p.referenceToleranceMs;
 return {provider:'ITICK',environment:'free',symbol:'DXY',value:finite(q?.ld)?q.ld:null,timestamp:finite(q?.t)?new Date(q.t).toISOString():null,fresh,valid,at:end?end.t+60000:null,available_at:now,move_5m_pct:valid?(end.c/r5.c-1)*100:null,move_15m_pct:valid?(end.c/r15.c-1)*100:null,reason:valid?'VERIFIED_COMPLETED_M1_CHANGES':'MISSING_STALE_OR_GAPPED_DXY',evidence:valid?{latest:end,reference5:r5,reference15:r15}:null};
}
export async function loadItickDxy({fetcher=fetch,now=Date.now(),apiKey=process.env.ITICK_API_KEY}={}){
 if(!apiKey)return normalizeDxy(null,[],now);
 try{const get=async path=>{const r=await fetcher(base+path,{headers:{token:apiKey,accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();const b=await r.json();if(b.code!==0)throw Error();return b.data;};
 const [q,bars]=await Promise.all([get('/quote?region=GB&code=DXY'),get('/kline?region=GB&code=DXY&kType=1&limit=30')]);return normalizeDxy(q,bars,now);
 }catch{return {...normalizeDxy(null,[],now),reason:'ITICK_REQUEST_OR_PERMISSION_FAILED'};}
}
