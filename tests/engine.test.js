import test from 'node:test';
import assert from 'node:assert/strict';
import {reversal} from '../engine/reversal.js';
import {continuation} from '../engine/continuation.js';
import {freshState,step} from '../engine/stateMachine.js';
import {riskPlan} from '../engine/risk.js';
import {rating} from '../engine/rating.js';
import {evaluate} from '../engine/index.js';
import {bars,quote,load} from '../data/jin10.js';
import {macro} from '../engine/macro.js';
import {migrateLevels} from '../engine/liquidity.js';
const base=Date.UTC(2026,0,1),M=300000;
const bar=(i,o,h,l,c)=>({at:base+i*M,end:base+(i+1)*M,open:o,high:h,low:l,close:c,tf:'M5'});
const seq=rows=>rows.map((r,i)=>bar(i,...r));
const mirror=rows=>rows.map(b=>({...b,open:300-b.open,close:300-b.close,high:300-b.low,low:300-b.high}));
const v=seq([[110,112,107,109],[109,110,105,106],[107,111,106,108],[108,108.1,106.4,106.5],[106.5,106.6,104.4,104.5],[104.5,104.6,101.4,101.5],[101.5,107,100,106]]);
const r=seq([[130,131,125,126],[125,126,115,116],[117,118,111,113],[114,115,109,112],[112,114,109.5,112],[112,113.8,109.7,112],[112,113.9,109.6,112],[112,113.7,109.8,112],[110,113,108,111]]);
const c=seq([[102,104,100,102],[102,104,100,102.1],[102,104,100,101.9],[102,104,100,102],[103,106,103,105]]);
v.unshift(bar(-1,110,111,108,110));r.unshift(bar(-1,130,130,124,129));
for(const [name,rows,fn] of [['V1',v,reversal],['V2',mirror(v),reversal],['R1',r,reversal],['R2',mirror(r),reversal],['C1',c,continuation],['C2',mirror(c),continuation]]){
  test(name+' identifies its synthetic price sequence',()=>{const x=fn(rows.slice(0,-1),rows.at(-1));assert.equal(x?.model,name);assert.equal(x.direction,name.endsWith('1')?'BUY':'SELL');assert.ok(x.trigger);});
}
test('V1 requires a later structure break, then a still later held retest',()=>{
  const s=freshState();for(const b of v)step(s,b);assert.equal(s.candidate?.stage,'RECLAIM');
  step(s,bar(7,106,112,105.5,111.5));assert.equal(s.candidate.stage,'STRUCTURE_SHIFT');assert.equal(s.candidate.retest,undefined);
  step(s,bar(8,111.5,111.8,110.8,111.2));assert.equal(s.candidate.stage,'SIGNAL_READY');assert.equal(s.candidate.retest_count,1);
  const same=structuredClone(s);step(s,bar(8,111.5,111.8,110.8,111.2));assert.deepEqual(s,same);
});
test('false V reclaim invalidates without immediate reversal',()=>{const s=freshState();for(const b of v)step(s,b);step(s,bar(7,106,106.5,103,104));assert.equal(s.candidate,null);assert.equal(s.history.at(-1).reason,'FAILED_RECLAIM');});
test('C1 requires acceptance and first retest; a failed breakout is rejected',()=>{
  const s=freshState();for(const b of c)step(s,b);assert.equal(s.candidate.stage,'BREAKOUT_TEST');
  const bad=structuredClone(s);step(bad,bar(5,105,105.5,102,103));assert.equal(bad.candidate,null);
  step(s,bar(5,105,107,104.5,106));assert.equal(s.candidate.stage,'STRUCTURE_SHIFT');
  step(s,bar(6,106,106.1,103.8,104.2));assert.equal(s.candidate.stage,'SIGNAL_READY');
});
test('gaps never confirm structure or fabricate retests',()=>{const s=freshState();for(const b of v)step(s,b);step(s,bar(9,106,113,105,112));assert.equal(s.candidate,null);assert.equal(s.history.at(-1).reason,'DATA_GAP');});
test('third distinct retest invalidates; consecutive touching bars count once',()=>{
  const s=freshState();for(const b of v)step(s,b);step(s,bar(7,106,112,105.5,111.5));step(s,bar(8,111.5,111.8,110.8,111.2));
  step(s,bar(9,111.2,112,110.9,111.3));assert.equal(s.candidate.retest_count,1);
  step(s,bar(10,111.3,112,111.2,111.8));step(s,bar(11,111.8,112,110.9,111.4));assert.equal(s.candidate.retest_count,2);
  step(s,bar(12,111.4,112,111.2,111.8));step(s,bar(13,111.8,112,110.9,111.4));assert.equal(s.candidate,null);
});
const setup={direction:'BUY',trigger:110,shift_at:base,retest_count:1,stage:'SIGNAL_READY',retest:{low:108,high:112,close:111}};
const levels=[{price:118,available_at:base},{price:122,available_at:base}];
test('risk uses actual stop and nearest liquidity target',()=>{const p=riskPlan(setup,110,levels);assert.equal(p.ok,true);assert.equal(p.stop_loss,107.99);assert.equal(p.tp1,118);assert.ok(p.rr1>=2);});
test('SL exceeding five is rejected, never tightened',()=>{const p=riskPlan({...setup,retest:{low:100,high:112,close:111}},110,levels);assert.equal(p.reason,'STRUCTURAL_STOP_EXCEEDS_5');assert.equal(p.stop_loss,99.99);});
test('entire advertised entry interval respects stop distance and RR',()=>{const p=riskPlan({...setup,retest:{low:108,high:115,close:114}},110,levels);assert.equal(p.ok,true);assert.ok(p.entry.high-p.stop_loss<=5);assert.ok((p.tp1-p.entry.high)/(p.entry.high-p.stop_loss)>=2);});
test('RR under two rejects nearest obstacle rather than skipping it',()=>{const p=riskPlan(setup,110,[{price:111,available_at:base},...levels]);assert.equal(p.reason,'RR_BELOW_2');assert.equal(p.tp1,111);});
const good={candidate:setup,plan:riskPlan(setup,110,levels),quality:{quote_fresh:true,confirmation_fresh:true,m5_quality:'GOOD',m15_quality:'GOOD'},macro:{event_risk:false,relation:'NONE',status:'AVAILABLE'},rangePosition:0.8,marketState:'BREAKOUT_TEST',durable:true,now:base,bootstrap:false};
test('range middle without structure remains observe and cannot allow',()=>{const x=rating({...good,candidate:{...setup,shift_at:null},rangePosition:.5,marketState:'BALANCE'});assert.notEqual(x.action,'ALLOW_ORDER');assert.ok(x.reasons.includes('RANGE_MIDDLE'));});
test('freshness, durable state, bootstrap, stale structure and news blackout gates',()=>{
  assert.equal(rating(good).action,'ALLOW_ORDER');
  for(const patch of [{durable:false},{bootstrap:true},{quality:{...good.quality,quote_fresh:false}},{quality:{...good.quality,confirmation_fresh:false}},{macro:{...good.macro,event_risk:true}}])assert.notEqual(rating({...good,...patch}).action,'ALLOW_ORDER');
});
test('incomplete, m1 count wrong, future, conflicting duplicates are excluded',()=>{
  const raw={ok:true,data:{code:'XAUUSD',timeframe:'M5',bars:[{time_epoch:base/1000,open:100,high:103,low:99,close:102,complete:true,m1_count:5}]}};
  assert.equal(bars(raw,'M5',base+M).valid.length,1);
  for(const patch of [{complete:false},{m1_count:4},{high:98}]){const x=structuredClone(raw);Object.assign(x.data.bars[0],patch);assert.equal(bars(x,'M5',base+M).valid.length,0);}
  assert.equal(bars(raw,'M5',base+M-1).valid.length,0);
  raw.data.bars.push({...raw.data.bars[0]});assert.equal(bars(raw,'M5',base+M).valid.length,0);
});
test('stale and future quotes cannot be fresh even if fetched_at is current',()=>{
  const raw={ok:true,fetched_at:new Date(base).toISOString(),data:{code:'XAUUSD',close:'100',time:new Date(base).toISOString()}};
  assert.equal(quote(raw,base+1).fresh,true);assert.equal(quote(raw,base+100000).fresh,false);assert.equal(quote(raw,base-1).fresh,false);
});
test('missing bar/news responses do not stop quote observation',async()=>{
  const input=await load({now:base,fetcher:async url=>{if(!url.includes('/quote'))throw Error('offline');return {ok:true,json:async()=>({ok:true,data:{code:'XAUUSD',close:'100',time:new Date(base).toISOString(),high:102,low:98,open:99}})};}});
  const x=evaluate(input);assert.equal(x.result.price,100);assert.equal(x.result.data_quality.m5_quality,'MISSING');assert.notEqual(x.result.action,'ALLOW_ORDER');assert.equal(x.state.path.length,1);
});
test('macro topic alone, future news and generic affect_txt do not assign gold direction',()=>{
  const input={now:base,calendar:{ok:true,data:[{actual:'3',affect_txt:'利多',title:'加拿大CPI',pub_time:'2026-01-01 08:00',star:3}]},flashes:[{ok:true,data:[{time:new Date(base+1).toISOString(),content:'CPI利多黄金'},{time:new Date(base).toISOString(),content:'美联储讲话'}]}]};
  const x=macro(input,null);assert.equal(x.bias,'NEUTRAL');assert.equal(x.event_risk,false);
});
function inputFor(rows,price=rows.at(-1).close){const now=rows.at(-1).end+1;return {now,quote:{price,at:now,fresh:true,day_open:99,day_low:98,day_high:130},m5:{valid:rows,quality:'GOOD',flags:[]},m15:{valid:[],quality:'MISSING',flags:[]},calendar:{ok:true,data:[]},flashes:[{ok:true,data:[]}],source_errors:[]};}
test('end-to-end V1 emits once after new confirmed retest and freezes its plan',()=>{
  const h=bar(7,106,112.4,105.5,111.5),i=bar(8,111.5,111.8,110.8,111.1);
  let x=evaluate(inputFor(v),null,{durable:true});assert.equal(x.result.action,'OBSERVE');
  x=evaluate(inputFor([...v,h]),x.state,{durable:true});assert.notEqual(x.result.action,'ALLOW_ORDER');
  x=evaluate(inputFor([...v,h,i]),x.state,{durable:true});assert.equal(x.result.action,'ALLOW_ORDER');assert.equal(x.result.stage,'SIGNAL_READY');assert.equal(x.state.candidate.stage,'ACTIVE');assert.ok(x.result.rr1>=2);assert.ok(x.result.risk_usd<=5);
  const id=x.result.signal_id,sl=x.result.stop_loss;
  x=evaluate(inputFor([...v,h,i]),x.state,{durable:true});assert.equal(x.result.action,'OBSERVE');assert.equal(x.result.signal_id,id);assert.equal(x.result.stop_loss,sl);
});
test('historical retest found at bootstrap never becomes a new order on a second poll',()=>{
  const rows=[...v,bar(7,106,112.4,105.5,111.5),bar(8,111.5,111.8,110.8,111.2)];
  let x=evaluate(inputFor(rows),null,{durable:true});assert.notEqual(x.result.action,'ALLOW_ORDER');x=evaluate(inputFor(rows),x.state,{durable:true});assert.notEqual(x.result.action,'ALLOW_ORDER');
});
test('out-of-order quote and revised complete candle do not create an order',()=>{
  const first=inputFor(v),x=evaluate(first,null,{durable:true}),old=structuredClone(first);old.quote.at-=1;
  assert.equal(evaluate(old,x.state,{durable:true}).result.data_quality.quote_fresh,false);
  const revised=structuredClone(first);revised.m5.valid[0].close+=.01;
  const result=evaluate(revised,x.state,{durable:true}).result;assert.notEqual(result.action,'ALLOW_ORDER');assert.ok(result.data_quality.flags.includes('REVISED_CONFIRMED_BAR'));
});
test('a prior observed day high migrates only after two later complete closes',()=>{
  const s=freshState(),q={fresh:true,at:base,day_high:104};migrateLevels(s,q,base);
  s.bars=[bar(0,103,106,103,105)];assert.equal(migrateLevels(s,q,base+M)[0].role,'RESISTANCE');
  s.bars.push(bar(1,105,107,104.5,106));assert.equal(migrateLevels(s,{...q,day_high:107},base+2*M)[0].role,'SUPPORT_CANDIDATE');
});
