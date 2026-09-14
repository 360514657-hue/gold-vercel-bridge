import {createHash} from 'node:crypto';
const macro={BULLISH:'偏多',BEARISH:'偏空',NEUTRAL:'中性'},side={BUY:'多',SELL:'空',NONE:'无交易'};
export function humanMessage(c){const lines=['宏观：'+macro[c.macro],'本单：'+side[c.side]];if(c.side!=='NONE')lines.push('入场：'+c.entry.toFixed(2),'止损：'+c.stop_loss.toFixed(2),'止盈：'+c.take_profit.toFixed(2));return lines.join('\n');}
export function alertView(c,updated_at,signal_id=null){return {macro:c.macro,side:c.side,entry:c.entry,stop_loss:c.stop_loss,take_profit:c.take_profit,human_message:humanMessage(c),updated_at,signal_id};}
const material=c=>[c.side,c.entry,c.stop_loss,c.take_profit];
export function updateAlert(state,contract,now){
 // One-time cleanup of retired notification state; never dispatch anything.
 delete state.email_outbox;delete state.last_alert_contract_hash;
 const legacy=state.latest_alert?.contract,prior=legacy??state.latest_alert;
 if(legacy){state.latest_alert=alertView(legacy,new Date(state.latest_alert.created_at).toISOString(),state.latest_alert.signal_id??null);state.alert_updated_at=state.latest_alert.updated_at;}
 const next={...contract};
 if(next.side!=='NONE'&&state.active_signal?.status==='ACTIVE')next.entry=state.active_signal.entry;
 const hash=createHash('sha256').update(JSON.stringify(material(next))).digest('hex');
 const changed=!prior||JSON.stringify(material(prior))!==JSON.stringify(material(next));
 if(changed){const signalId=next.side==='NONE'?(state.latest_alert?.signal_id??null):(state.active_signal?.signal_id??state.candidate?.id??null);state.alert_updated_at=new Date(now).toISOString();state.latest_alert=alertView(next,state.alert_updated_at,signalId);}
 state.latest_alert_contract_hash=hash;
 return changed;
}
