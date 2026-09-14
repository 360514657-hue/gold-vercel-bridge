import {createHash} from 'node:crypto';
const macro={BULLISH:'偏多',BEARISH:'偏空',NEUTRAL:'中性'},side={BUY:'多',SELL:'空',NONE:'无交易'};
export function humanMessage(c){const lines=['宏观：'+macro[c.macro],'本单：'+side[c.side]];if(c.side!=='NONE')lines.push('入场：'+c.entry.toFixed(2),'止损：'+c.stop_loss.toFixed(2),'止盈：'+c.take_profit.toFixed(2));return lines.join('\n');}
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function updateAlert(state,contract,now){
 const prior=state.latest_alert?.contract;const material=c=>c?[c.side,c.entry,c.stop_loss,c.take_profit]:['NONE',null,null,null];
 const changed=JSON.stringify(material(prior))!==JSON.stringify(material(contract));
 if(changed||!state.latest_alert){const id=digest([now,contract,state.active_signal?.signal_id,state.revision??0]);state.latest_alert={id,contract:structuredClone(contract),human_message:humanMessage(contract),created_at:now,signal_id:state.active_signal?.signal_id??state.candidate?.id??null,email_status:changed?'PENDING':'NO_CHANGE',signal_only:true};state.last_alert_contract_hash=digest(contract);
 if(changed)state.email_outbox=[...(state.email_outbox??[]).filter(x=>x.status==='SENDING'),{...structuredClone(state.latest_alert),status:'PENDING',attempts:0}];
 }else{state.latest_alert.contract=structuredClone(contract);state.latest_alert.human_message=humanMessage(contract);state.last_alert_contract_hash=digest(contract);}
 return changed;
}
