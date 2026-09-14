import {macroFilter} from '../engine/macroFilter.js';
import {manageActive} from '../engine/active.js';
import {structureAudit} from '../engine/structure-audit.js';
import {updateAlert} from '../notifications/alerts.js';
import {executionDecision,persistExecution} from '../engine/execution.js';
import {appendTransition} from './transitions.js';
import {freshState} from '../engine/stateMachine.js';
import {executionVersion,chaseLimit} from '../engine/timeliness.js';
import {load} from '../data/jin10.js';
import {evaluate} from '../engine/index.js';
import {store} from '../state/store.js';
import {createHash} from 'node:crypto';
import {macro} from '../engine/macro.js';
import {policy} from '../config/policy.js';
export async function signal({repository=store(),loader=load,now=Date.now(),logger=x=>console.log(JSON.stringify(x)),requireDurable=false}={}){
  const started=performance.now();
  if(requireDurable&&!repository.durable)throw Error('DURABLE_STATE_REQUIRED');
  const input=await loader({now});
  for(let i=0;i<3;i++){
    const raw=await repository.read(),before=raw?JSON.parse(raw):null;
    const key=createHash('sha256').update(JSON.stringify({serviceVersion:'alerts_read_v2',dxy:input.dxy,macro_facts:input.macro_facts,executionVersion,chaseLimit:chaseLimit(),quote:input.quote,m5:input.m5,m15:input.m15,macro:macro(input,before?.candidate),errors:input.source_errors})).digest('hex');
    // Different API views of the same market update must not consume each other's
    // signal. A stable signal_id lets clients deduplicate; this is not an order.
    if(!requireDurable&&before?.last_input_hash===key&&before.latest_result&&input.now<=before.cache_until)return {...before.latest_result,time:new Date(input.now).toISOString()};
    const unavailable=!input.quote.fresh||input.quote.at<(before?.path?.at(-1)?.at??0);
    const {state,result}=unavailable?{state:structuredClone(before??freshState()),result:{time:new Date(input.now).toISOString(),price:input.quote.price,stage:'DEGRADED',action:'NO_TRADE',signal_id:before?.candidate?.id??null,model:before?.candidate?.model??null,reason:[!repository.durable?'DURABLE_STATE_REQUIRED':'QUOTE_NOT_FRESH'],data_quality:{quote_fresh:false,state_durable:repository.durable,flags:input.m5.flags,source_errors:input.source_errors},signal_only:true,order_executed:false,debug:{conditions:{quote_fresh:false}}}}:evaluate(input,before,{durable:repository.durable});
    // Preserve terminal invalidation for the poll that observes it, even after engine retirement.
    if(!unavailable&&!state.candidate&&before?.candidate&&state.history?.at(-1)?.id===before.candidate.id&&state.history.at(-1).stage==='INVALIDATED'){
      result.stage='INVALIDATED';result.signal_id=before.candidate.id;result.model=before.candidate.model;result.action='NO_TRADE';result.reason=[state.history.at(-1).reason];
    }
    result.news_context=result.macro??null;
    const filteredMacro=macroFilter(input);result.macro={...filteredMacro,event_risk:filteredMacro.events.blocked};result.macro_bias=filteredMacro.bias;
    result.debug.xauusd_quote=input.quote;result.debug.dxy=input.dxy??null;
    const decision=manageActive(state,input,result,executionDecision(input,state,result));
    result.debug.active_management=decision.management;
    result.debug.structure_steps=structureAudit(state.candidate,input.m5.valid);
    if(decision.management?.status==='ACTIVE'){result.stage='ACTIVE';result.signal_id=decision.management.signal_id;}
    else if(decision.management?.closed_at===input.now)result.stage='CLOSED';
    result.action=decision.contract.side==='NONE'?'NO_TRADE':'SIGNAL_ONLY';
    updateAlert(state,decision.contract,input.now);
    persistExecution(state,before,decision,input.now);
    result.execution=decision.contract;result.debug.execution=decision.debug;
    if(input.macro_market)result.debug.macro_market={status:input.macro_market.status,snapshot:input.macro_market.snapshot,symbols:input.macro_market.symbols,validation:input.macro_market.validation};
    state.revision=(before?.revision??0)+1;state.updated_at=new Date(input.now).toISOString();
    if(requireDurable)state.last_watch={at:state.updated_at,state_version:state.revision,stage:result.stage,action:result.action};
 result.debug.persistence={state_version:state.revision,state_schema_version:state.version,updated_at:state.updated_at,current_stage:result.stage,current_model:result.model,retest_count:state.candidate?.retest_count??0,extreme:result.extreme??null,reclaim_level:result.reclaim_level??null,trigger_level:result.trigger_level??null};
 const transition=appendTransition(state,before,result,Math.round(performance.now()-started));
 if(result.execution.side!=='NONE')state.latest_signal_time=result.time;
 state.last_input_hash=key;state.latest_result=result;state.cache_until=Math.min(input.quote.at+policy.quoteMaxAgeMs,state.candidate?.expires_at??Infinity);
    if(await repository.compareAndSet(raw,JSON.stringify(state))){if(transition){try{logger(transition);}catch{}}return result;}
  }
  throw Error('STATE_CONFLICT_RETRY_LATER');
}
export function scanner(x){return {time:x.time,timestamp:x.time,stage:x.stage,confidence:x.confidence,price:x.price,rating:x.rating,action:x.action,model:x.model,direction:x.bias==='LONG'?'BUY':x.bias==='SHORT'?'SELL':null,
  entry:x.entry?`${x.entry.low}-${x.entry.high}`:null,sl:x.stop_loss,tp1:x.tp1,tp2:x.tp2,signal_id:x.signal_id,signal_only:true};}
