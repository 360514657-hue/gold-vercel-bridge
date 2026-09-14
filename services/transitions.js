export const EVENT_LIMIT=200;
export function appendTransition(state,before,result,latency_ms){
 const last=before?.transitions?.at(-1);
 const previous=last?.new_stage??before?.latest_result?.stage??null;
 if(previous===result.stage&&(last?.signal_id??before?.latest_result?.signal_id??null)===(result.signal_id??null)){state.transitions=before?.transitions??[];return null;}
 const event={timestamp:result.time,previous_stage:previous,new_stage:result.stage,signal_id:result.signal_id??null,price:result.price??null,model:result.model??null,direction:result.bias==='LONG'?'BUY':result.bias==='SHORT'?'SELL':null,entry:result.entry??null,sl:result.stop_loss??null,tp1:result.tp1??null,tp2:result.tp2??null,trigger_level:result.trigger_level??null,extreme:result.extreme??null,reclaim_level:result.reclaim_level??null,reason:result.reason??[],action:result.action,data_quality:result.data_quality,latency_ms};
 state.transitions=[...(before?.transitions??[]),event].slice(-EVENT_LIMIT);return event;
}
