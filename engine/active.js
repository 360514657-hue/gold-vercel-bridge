import {swings} from './structure.js';import {volatility,noExecution} from './execution.js';import {macroFilter} from './macroFilter.js';
const cents=x=>Math.round(x*100)/100;
export function manageActive(state,input,result,decision){
 const mac=macroFilter(input),q=input.quote;let a=state.active_signal;
 const safe=q.fresh===true&&Number.isFinite(q.price)&&q.price>0&&Number.isFinite(q.at)&&q.at<=input.now&&input.now-q.at<=90000&&mac.acceptable&&!mac.events.blocked&&result.data_quality?.state_durable===true&&result.data_quality?.confirmation_fresh===true&&input.m5?.quality==='GOOD'&&input.m15?.quality==='GOOD';
 if(a?.status==='ACTIVE'){
 const sign=a.side==='BUY'?1:-1;
 // Observe stop/target first with old levels, even when macro is unavailable. Never claim fills.
 if(q.fresh&&Number.isFinite(q.at)&&q.at<=input.now&&q.at>a.last_quote_at){
 a.last_quote_at=q.at;
 if(sign*(q.price-a.stop_loss)<=0||sign*(q.price-a.take_profit)>=0){a.status='CLOSED';a.closed_at=input.now;a.close_reason=sign*(q.price-a.stop_loss)<=0?'STOP_OBSERVED':'TARGET_OBSERVED';state.active_history=[...(state.active_history??[]),structuredClone(a)].slice(-200);return {...decision,contract:noExecution(mac.bias),management:a};}
 }
 if(safe){const rows=input.m5.valid.filter(b=>b.end<=input.now),s=swings(rows),pivots=a.side==='BUY'?s.low:s.high;
 const v=volatility(rows,rows.at(-1)?.end??0),pivot=pivots.at(-1),prev=pivots.at(-2);
 if(v&&pivot&&prev&&pivot.at>=a.activated_at&&pivot.available_at>a.last_structure_at&&sign*(pivot.price-prev.price)>0){
 let proposed=pivot.price-sign*v.buffer;
 if(sign*(q.price-a.entry)>=a.initial_risk)proposed=a.side==='BUY'?Math.max(proposed,a.entry):Math.min(proposed,a.entry);
 proposed=a.side==='BUY'?Math.floor(proposed*100)/100:Math.ceil(proposed*100)/100;
 if(sign*(proposed-a.stop_loss)>0&&sign*(q.price-proposed)>0){a.stop_loss=proposed;a.management_events.push({event:'STOP_TIGHTENED',at:input.now,price:proposed,reference:pivot.id,confirmation_at:pivot.available_at,buffer:v.buffer});}
 a.last_structure_at=pivot.available_at;
 }
 const aligned=a.side==='BUY'?mac.bias==='BULLISH':mac.bias==='BEARISH';
 const opposite=state.candidate&&state.candidate.direction!==a.side&&state.candidate.shift_at>a.activated_at&&state.candidate.shift_at<=input.now;
 if(!aligned||opposite){const targets=(result.key_levels??[]).filter(l=>Number.isFinite(l.available_at)&&l.available_at<=input.now&&Number.isFinite(l.price)&&sign*(l.price-q.price)>0&&sign*(l.price-a.entry)>0&&sign*(a.take_profit-l.price)>0).sort((x,y)=>sign*(x.price-y.price));
 if(targets.length){a.take_profit=cents(targets[0].price);a.management_events.push({event:'TP_TIGHTENED',at:input.now,price:a.take_profit,reference:targets[0].type??'OBSERVED_LEVEL'});}}
 a.management_events=a.management_events.slice(-200);
 }
 return {...decision,contract:safe?{macro:mac.bias,side:a.side,entry:a.entry,stop_loss:a.stop_loss,take_profit:a.take_profit}:noExecution(mac.bias),management:a};
 }
 const id=state.candidate?.id;
 if(decision.contract.side!=='NONE'&&safe&&id&&!(state.activated_signal_ids??[]).includes(id)){
 const c=decision.contract;a={signal_id:id,status:'ACTIVE',side:c.side,entry:c.entry,initial_stop_loss:c.stop_loss,initial_take_profit:c.take_profit,activated_at:input.now,stop_loss:c.stop_loss,take_profit:c.take_profit,initial_risk:Math.abs(c.entry-c.stop_loss),last_quote_at:q.at,last_structure_at:input.now,management_events:[],execution_kind:'SIGNAL_ACTIVATION_NOT_BROKER_FILL'};
 state.active_signal=a;state.activated_signal_ids=[...(state.activated_signal_ids??[]),id];return {...decision,management:a};
 }
 return {...decision,contract:decision.contract.side!=='NONE'?noExecution(mac.bias):decision.contract,management:a??null};
}
