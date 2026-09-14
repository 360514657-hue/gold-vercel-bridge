import {macroMarketPolicy as p} from '../../config/macro-market.js';
const origin='https://api.tradingeconomics.com';
const specs={DXY:{key:'dxy',match:r=>r.Country==='United States'&&/^(?:us |u\.s\. |united states )?dollar index$|^dxy$/i.test(r.Name??'')},US2Y:{key:'us2y',match:r=>r.Country==='United States'&&/^(?:US 2Y|(?:United States |US )?2[ -]Year(?: Treasury| Government)?(?: Bond)? Yield)$/i.test(r.Name??'')&&/^bond$/i.test(r.Type??'')},US10Y:{key:'us10y',match:r=>r.Country==='United States'&&/^(?:US 10Y|(?:United States |US )?10[ -]Year(?: Treasury| Government)?(?: Bond)? Yield)$/i.test(r.Name??'')&&/^bond$/i.test(r.Type??'')}};
export function teTime(x){if(typeof x!=='string'||!/^\d{4}-\d\d-\d\dT/.test(x))return NaN;return Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(x)?x:x+'Z');} // Official Date field is UTC.
const numeric=x=>typeof x==='number'&&Number.isFinite(x);
export function selectSymbols(rows){const selected={};for(const [name,spec] of Object.entries(specs)){const hits=[...new Map(rows.filter(r=>spec.match(r)&&typeof r.Symbol==='string'&&/^[A-Za-z0-9:._-]{1,80}$/.test(r.Symbol)).map(r=>[r.Symbol,r])).values()];if(hits.length!==1)throw Error('TE_SYMBOL_DISCOVERY_AMBIGUOUS_OR_MISSING');selected[name]={symbol:hits[0].Symbol,name:hits[0].Name,country:hits[0].Country,type:hits[0].Type};}return selected;}
export async function teRequest(path,{apiKey=process.env.TRADING_ECONOMICS_API_KEY,fetcher=fetch}={}){
 if(!apiKey)throw Error('TE_CREDENTIAL_REQUIRED');
 try{const r=await fetcher(origin+path,{headers:{Authorization:apiKey,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();const rows=await r.json();if(!Array.isArray(rows))throw Error();return rows;}catch{throw Error('TE_REQUEST_OR_ENTITLEMENT_FAILED');}
}
export function normalizeTE(quote,history,identity,name,now){
 const at=teTime(quote?.Date),value=quote?.Last;
 const identityOK=quote?.Symbol===identity.symbol&&quote?.Name===identity.name&&quote?.Country===identity.country&&/^live$/i.test(quote?.frequency??'');
 const unitOK=name==='DXY'?/index points/i.test(quote?.unit??'')&&value>50&&value<150:/^(%|percent|percentage)$/i.test(quote?.unit??'')&&value>0&&value<20;
 const fresh=!!(identityOK&&unitOK&&numeric(value)&&Number.isFinite(at)&&at<=now&&now-at<=p.maxAgeMs);
 const snapshot={value:numeric(value)?value:null,timestamp:Number.isFinite(at)?new Date(at).toISOString():null,fresh};
 const points=history.map(b=>({at:teTime(b.Date)+60000,value:b.Close,row:b})).sort((a,b)=>a.at-b.at);
 const known=points.filter(x=>Number.isFinite(x.at)&&x.at<=at&&x.at>=at-17*60000);
 const historyOK=known.length>=16&&known.every((x,i)=>x.row.Symbol===identity.symbol&&['Open','High','Low','Close'].every(k=>numeric(x.row[k])&&x.row[k]>0)&&x.row.High>=Math.max(x.row.Open,x.row.Close,x.row.Low)&&x.row.Low<=Math.min(x.row.Open,x.row.Close,x.row.High)&&(!i||x.at-known[i-1].at===60000));
 const ref=m=>known.filter(x=>x.at<=at-m*60000).at(-1),r5=ref(5),r15=ref(15);
 const refsOK=[5,15].every(m=>{const r=ref(m);return r&&at-m*60000-r.at<=p.referenceToleranceMs;});
 const verified=fresh&&historyOK&&refsOK;
 return {snapshot,fact:{provider:'TRADING_ECONOMICS',symbol:identity.symbol,verified,execution_eligible:verified,value:numeric(value)?value:null,at,available_at:now,reference_5m:r5?.value??null,reference_5m_at:r5?.at??null,reference_15m:r15?.value??null,reference_15m_at:r15?.at??null,reason:verified?'VERIFIED_QUOTE_AND_1M_HISTORY':'QUOTE_IDENTITY_UNIT_FRESHNESS_OR_HISTORY_UNVERIFIED'},validation:{verified,history_1m:historyOK,change_5m_available:!!(verified&&r5),change_15m_available:!!(verified&&r15)}};
}
export async function loadTradingEconomics({apiKey=process.env.TRADING_ECONOMICS_API_KEY,fetcher=fetch,now=Date.now()}={}){
 const snapshot={dxy:{value:null,timestamp:null,fresh:false},us2y:{value:null,timestamp:null,fresh:false},us10y:{value:null,timestamp:null,fresh:false}},facts={},validation={};
 if(!apiKey)return {snapshot,facts,validation,status:'TE_CREDENTIAL_REQUIRED',symbols:{}};
 const request=path=>teRequest(path,{apiKey,fetcher});let symbols={};
 try{
 const results=await Promise.all(['dollar index','united states'].map(term=>request('/markets/search/'+encodeURIComponent(term))));symbols=selectSymbols(results.flat());
 await Promise.all(Object.entries(symbols).map(async([name,id])=>{
  try{const sym=await request('/markets/symbology/symbol/'+encodeURIComponent(id.symbol));if(!sym.some(x=>x.Symbol===id.symbol&&x.Name===id.name))throw Error();
  const d1=new Date(now-30*60000).toISOString().slice(0,16),d2=new Date(now).toISOString().slice(0,16);
  const [quotes,history]=await Promise.all([request('/markets/symbol/'+encodeURIComponent(id.symbol)),request('/markets/intraday/'+encodeURIComponent(id.symbol)+'?agr=1m&d1='+encodeURIComponent(d1)+'&d2='+encodeURIComponent(d2))]);
  const matches=quotes.filter(q=>q.Symbol===id.symbol);if(matches.length!==1)throw Error();
  const x=normalizeTE(matches[0],history,id,name,now);snapshot[specs[name].key]=x.snapshot;facts[name]=x.fact;validation[name]=x.validation;
  }catch{validation[name]={verified:false,reason:'TE_IDENTITY_QUOTE_OR_HISTORY_FAILED'};}
 }));
 const all=Object.values(validation).length===3&&Object.values(validation).every(x=>x.verified);
 // No partial first-run activation: every instrument must validate in this snapshot.
 // macroV2 requires all three valid components before permitting a direction.
 return {snapshot,facts,validation,symbols,status:all?'VERIFIED':'NOT_VERIFIED'};
 }catch{return {snapshot,facts,validation,symbols,status:'TE_DISCOVERY_OR_ENTITLEMENT_FAILED'};}
}
