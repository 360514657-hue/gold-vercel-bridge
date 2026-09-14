import {executionVersion,chaseLimit} from '../engine/timeliness.js';
import {load} from '../data/jin10.js';
import {evaluate} from '../engine/index.js';
import {store} from '../state/store.js';
import {createHash} from 'node:crypto';
import {macro} from '../engine/macro.js';
import {policy} from '../config/policy.js';
export async function signal({repository=store(),loader=load,now=Date.now(),logger=x=>console.log(JSON.stringify(x))}={}){
  const input=await loader({now});
  for(let i=0;i<3;i++){
    const raw=await repository.read(),before=raw?JSON.parse(raw):null;
    const key=createHash('sha256').update(JSON.stringify({executionVersion,chaseLimit:chaseLimit(),quote:input.quote,m5:input.m5,m15:input.m15,macro:macro(input,before?.candidate),errors:input.source_errors})).digest('hex');
    // Different API views of the same market update must not consume each other's
    // signal. A stable signal_id lets clients deduplicate; this is not an order.
    if(before?.last_input_hash===key&&before.latest_result&&input.now<=before.cache_until)return {...before.latest_result,time:new Date(input.now).toISOString()};
    const {state,result}=evaluate(input,before,{durable:repository.durable});
    state.revision=(before?.revision??0)+1;state.updated_at=new Date(input.now).toISOString();
 result.debug.persistence={state_version:state.revision,state_schema_version:state.version,updated_at:state.updated_at,current_stage:result.stage,current_model:result.model,retest_count:state.candidate?.retest_count??0,extreme:result.extreme,reclaim_level:result.reclaim_level,trigger_level:result.trigger_level};
 const changed=before?.latest_result?.stage!==result.stage||before?.latest_result?.signal_id!==result.signal_id;
 const transition=changed?{timestamp:result.time,price:result.price,previous_stage:before?.latest_result?.stage??null,new_stage:result.stage,model:result.model,trigger:result.trigger_level,key_levels:result.key_levels,entry:result.entry,sl:result.stop_loss,tp1:result.tp1,tp2:result.tp2,rating:result.rating,confidence:result.confidence,action:result.action,data_quality:result.data_quality}:null;
 state.transitions=[...(before?.transitions??[]),...(transition?[transition]:[])].slice(-100);
 if(result.action==='ALLOW_ORDER')state.latest_signal_time=result.time;
 state.last_input_hash=key;state.latest_result=result;state.cache_until=Math.min(input.quote.at+policy.quoteMaxAgeMs,state.candidate?.expires_at??Infinity);
    if(await repository.compareAndSet(raw,JSON.stringify(state))){if(transition){try{logger(transition);}catch{}}return result;}
  }
  throw Error('STATE_CONFLICT_RETRY_LATER');
}
export function scanner(x){return {time:x.time,timestamp:x.time,stage:x.stage,confidence:x.confidence,price:x.price,rating:x.rating,action:x.action,model:x.model,direction:x.bias==='LONG'?'BUY':x.bias==='SHORT'?'SELL':null,
  entry:x.entry?`${x.entry.low}-${x.entry.high}`:null,sl:x.stop_loss,tp1:x.tp1,tp2:x.tp2,signal_id:x.signal_id,signal_only:true};}
