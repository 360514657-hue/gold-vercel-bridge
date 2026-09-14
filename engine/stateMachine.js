import {retestStep} from './retest.js';
import {policy} from '../config/policy.js';
import {reversal} from './reversal.js';
import {continuation} from './continuation.js';
import {shifted} from './structure.js';
export function freshState(){return {version:policy.version,bars:[],watermark:0,candidate:null,path:[],session:{},history:[],bootstrap:true};}
function event(c,name,b){c.evidence.push({event:name,at:b.end,bar_at:b.at});c.evidence=c.evidence.slice(-30);}
export function step(state,b){
  if(b.end<=state.watermark)return;
  const prior=state.bars,last=prior.at(-1);let c=state.candidate;
  if(last&&last.end!==b.at){if(c){c.stage='INVALIDATED';c.invalidation_reason='DATA_GAP';}state.bars=[];}
  if(c&&!['INVALIDATED','TP2'].includes(c.stage)){
    const long=c.direction==='BUY',failed=long?b.low<=c.extreme:b.high>=c.extreme;
    if(failed||b.end-c.created_at>policy.setupExpiryBars*300000){c.stage='INVALIDATED';c.invalidation_reason=failed?'STRUCTURAL_EXTREME_BROKEN':'SETUP_EXPIRED';event(c,'INVALIDATED',b);}
    else if(c.stage==='BREAKOUT_TEST'){
      if(shifted(c,b)){c.stage='STRUCTURE_SHIFT';c.shift_at=b.end;event(c,'ACCEPTANCE',b);event(c,'STRUCTURE_SHIFT',b);}
      else {c.stage='INVALIDATED';c.invalidation_reason='FAILED_BREAKOUT';event(c,'FAILED_BREAKOUT',b);}
    } else if(c.stage==='RECLAIM'){
      if(long?b.close<c.reclaim:b.close>c.reclaim){c.stage='INVALIDATED';c.invalidation_reason='FAILED_RECLAIM';event(c,'FAILED_RECLAIM',b);}
      else if(shifted(c,b)){c.stage='STRUCTURE_SHIFT';c.shift_at=b.end;event(c,'STRUCTURE_SHIFT',b);}
      else if(b.end-c.event_at>policy.sweepExpiryBars*300000){c.stage='INVALIDATED';c.invalidation_reason='RECLAIM_TIMEOUT';}
    } else if(['STRUCTURE_SHIFT','FIRST_RETEST','SIGNAL_READY','ACTIVE','TP1'].includes(c.stage)&&b.at>=c.shift_at){
      const contact=long?b.low<=c.trigger:b.high>=c.trigger;
      if(contact&&!c.in_contact){c.retest_count++;event(c,'RETEST',b);}c.in_contact=contact;
      if(c.retest_count>=3){c.stage='INVALIDATED';c.invalidation_reason='THIRD_RETEST';}
      else if(contact||c.pending_retest||c.retest){
        const outcome=retestStep(c,b);
        if(outcome==='CONFIRMED'){c.expires_at=b.end+policy.signalTTL;event(c,'FIRST_RETEST',b);}
        else if(outcome){c.stage='INVALIDATED';c.invalidation_reason=outcome;event(c,'INVALIDATED',b);}
      }
    }
  }
  // A new setup never inherits a stopped/invalidated setup's trigger on this bar.
  if(!c){c=reversal(state.bars,b)??continuation(state.bars,b);if(c)c.id=`${c.model}:${b.end}`;state.candidate=c;}
  else if(['INVALIDATED','TP2'].includes(c.stage)){
    state.history.push({id:c.id,stage:c.stage,at:b.end,reason:c.invalidation_reason});state.history=state.history.slice(-30);state.candidate=null;
  }
  state.bars.push(b);state.bars=state.bars.slice(-120);state.watermark=b.end;
}
export function observeQuote(state,q){
  if(!q.fresh||q.at<= (state.path.at(-1)?.at??0))return;
  const previous=state.path.at(-1);state.path.push({at:q.at,price:q.price});state.path=state.path.slice(-300);
  const key=Math.floor(q.at/28800000),s=state.session;
  if(s.key!==key){s.previous=s.key===key-1?{high:s.high,low:s.low,ended_at:key*28800000,quality:'OBSERVED_QUOTES_ONLY'}:null;s.key=key;s.high=q.price;s.low=q.price;}
  s.high=Math.max(s.high,q.price);s.low=Math.min(s.low,q.price);
  const c=state.candidate;
  if(!c)return;
  const long=c.direction==='BUY';
  if(long?q.price<=c.extreme:q.price>=c.extreme){c.stage='INVALIDATED';c.invalidation_reason='QUOTE_EXTREME_BREACH';}
  if(c.plan&&['ACTIVE','TP1'].includes(c.stage)){
    // Sampled quote crossings are observations, never fills or profitability outcomes.
    if(long?q.price<=c.plan.stop_loss:q.price>=c.plan.stop_loss)c.stage='INVALIDATED';
    else if(c.plan.tp2!==null&&(long?q.price>=c.plan.tp2:q.price<=c.plan.tp2))c.stage='TP2';
    else if(long?q.price>=c.plan.tp1:q.price<=c.plan.tp1)c.stage='TP1';
    if(previous&&q.at-previous.at>policy.quoteMaxAgeMs)c.monitoring_gap=true;
  }
}
