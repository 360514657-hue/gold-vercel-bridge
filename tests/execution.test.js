import test from 'node:test';import assert from 'node:assert/strict';
import {executionDecision,persistExecution,noExecution} from '../engine/execution.js';import {macroV2} from '../engine/macroV2.js';import {executionHandler} from '../services/execution.js';import {loadFredDaily} from '../data/providers/fred.js';
const base=Date.UTC(2026,0,1),M=300000,now=base+6*M+1;
function fixture(direction='BUY',bias='BULLISH'){
 const sell=direction==='SELL',facts=Object.fromEntries(['DXY','US2Y','US10Y'].map(k=>[k,{provider:'TEST_ONLY',verified:true,execution_eligible:true,value:bias==='BULLISH'?-1:bias==='BEARISH'?1:0,reference:0,at:now-1,reference_at:now-60000,available_at:now-1}]));
 const bars=Array.from({length:6},(_,i)=>({at:base+i*M,end:base+(i+1)*M,open:100,high:101,low:99,close:100}));
 const c={id:'fixture',direction,model:sell?'V2':'V1',stage:'SIGNAL_READY',shift_at:now-M,liquidity:sell?105:95,retest_count:1,retest:{at:now-1,low:98,high:102,close:100},evidence:[{event:sell?'SWEEP_HIGH':'SWEEP_LOW',at:now-2*M},{event:'RECLAIM',at:now-2*M}],expires_at:now+M};
 return {input:{now,quote:{price:100,fresh:true},macro_facts:facts,m5:{valid:bars},calendar:{ok:true}},state:{candidate:c},result:{stage:'SIGNAL_READY',market_state:'BALANCE',macro:{event_risk:false},data_quality:{quote_fresh:true,state_durable:true,confirmation_fresh:true},key_levels:(sell?[94,91]:[106,109]).map(price=>({price,available_at:base}))}};
}
const decide=f=>executionDecision(f.input,f.state,f.result);
for(const [d,b] of [['SELL','BEARISH'],['BUY','BULLISH']])test(b+' aligned complete first retest permits '+d,()=>assert.equal(decide(fixture(d,b)).contract.side,d));
for(const [d,b] of [['BUY','BEARISH'],['SELL','BULLISH']]){
 test(b+' ordinary opposing continuation without macro failure is NONE',()=>{const f=fixture(d,b);f.state.candidate.model=d==='BUY'?'C1':'C2';f.state.candidate.evidence=[{event:'ACCEPTANCE',at:now-M}];const x=decide(f);assert.equal(x.contract.side,'NONE');assert.equal(x.debug.macro_failure,false);assert.equal(x.debug.resonance,'CONFLICT');});
 test(b+' confirmed opposing reversal permits '+d+' with macro failure',()=>{const x=decide(fixture(d,b));assert.equal(x.contract.side,d);assert.equal(x.debug.macro_failure,true);});
}
const rejects={
 'neutral incomplete structure':f=>{f.input.macro_facts=fixture('BUY','NEUTRAL').input.macro_facts;f.state.candidate.shift_at=null;},
 'structural stop above 5':f=>{f.state.candidate.retest.low=94;},
 'nearest target below 2R':f=>{f.result.key_levels.unshift({price:101,available_at:base});},
 'no observed target':f=>{f.result.key_levels=[];},
 'future target':f=>{f.result.key_levels.forEach(l=>l.available_at=now+M);},
 'high impact event window':f=>{f.result.macro.event_risk=true;},
 'unknown calendar':f=>{f.input.calendar.ok=false;},
 'second retest':f=>{f.state.candidate.retest_count=2;},
 'third retest':f=>{f.state.candidate.retest_count=3;},
 'stale quote':f=>{f.input.quote.fresh=false;},
 'missing critical DXY':f=>{delete f.input.macro_facts.DXY;},
 'unverified macro':f=>{f.input.macro_facts.DXY.verified=false;},
 'incomplete volatility window':f=>{f.input.m5.valid.pop();},
 'gapped volatility bars':f=>{f.input.m5.valid[2].at+=1;},
 'non durable state':f=>{f.result.data_quality.state_durable=false;},
 'missed entry':f=>{f.input.quote.price=103;},
 'duplicate closed candidate':f=>{f.state.execution_closed_ids=['fixture'];}
};
for(const [name,patch] of Object.entries(rejects))test(name+' yields NONE and null prices',()=>{const f=fixture();patch(f);const x=decide(f).contract;assert.equal(x.side,'NONE');assert.equal(x.entry,null);assert.equal(x.stop_loss,null);assert.equal(x.take_profit,null);});
test('same structure fixes Entry/SL/TP despite quote movement',()=>{const f=fixture(),a=decide(f).contract;assert.deepEqual(a,decide(f).contract);f.input.quote.price=100.2;assert.deepEqual(decide(f).contract,a);assert.equal(a.entry,100);assert.equal(a.stop_loss,97.7);});
test('STRONG selects second target only after nearer target passes 2R',()=>{const f=fixture();f.result.market_state='TREND_UP';let x=decide(f);assert.equal(x.debug.resonance,'STRONG');assert.equal(x.contract.take_profit,109);f.result.key_levels.unshift({price:101,available_at:base});assert.equal(decide(f).contract.side,'NONE');});
test('macro numeric signs, critical missing neutral and future source exclusion',()=>{const f=fixture();assert.equal(macroV2(f.input.macro_facts,now).score,75);f.input.macro_facts.DXY.available_at=now+1;const x=macroV2(f.input.macro_facts,now);assert.equal(x.bias,'NEUTRAL');assert.equal(x.acceptable,false);});
function response(){return {setHeader(){},status(n){this.code=n;return this;},send(s){this.text=s;this.body=JSON.parse(s);return this;}};}
test('execution endpoint has only five fields and two-decimal numeric JSON',async()=>{const r=response();await executionHandler({run:async()=>({execution:decide(fixture()).contract})})({method:'GET'},r);assert.deepEqual(Object.keys(r.body),['macro','side','entry','stop_loss','take_profit']);assert.ok(r.text.includes('100.00'));assert.ok(r.text.includes('97.70'));assert.equal(r.body.side,'BUY');});
test('execution endpoint failures redact errors and return only null-price contract',async()=>{const r=response();await executionHandler({run:async()=>{throw Error('secret')}})({method:'GET'},r);assert.equal(r.code,503);assert.deepEqual(r.body,noExecution());assert.ok(!r.text.includes('secret'));});
test('watcher contract events deduplicate and withdrawn candidate cannot be reissued',()=>{let state=fixture().state;const d=decide(fixture());persistExecution(state,null,d,now);assert.equal(state.execution_events.length,1);let before=structuredClone(state);persistExecution(state,before,d,now+60000);assert.equal(state.execution_events.length,1);before=structuredClone(state);persistExecution(state,before,{contract:noExecution()},now+120000);assert.equal(state.execution_events.length,2);assert.ok(state.execution_closed_ids.includes('fixture'));});
test('daily FRED adapter never pretends validated intraday data',async()=>{const x=await loadFredDaily({now,fetcher:async url=>({ok:true,text:async()=>{const id=new URL(url).searchParams.get('id');return 'observation_date,'+id+'\n2026-01-01,4.0';}})});assert.equal(x.US2Y.series_id,'DGS2');assert.equal(x.US2Y.value,4);assert.equal(x.US2Y.execution_eligible,false);assert.equal(macroV2(x,now).acceptable,false);});
test('contract builder has no order execution side effect',()=>{const f=fixture(),before=structuredClone(f);decide(f);assert.deepEqual(f,before);});
