import {timing,missed} from './timeliness.js';
import {freshState,step,observeQuote} from './stateMachine.js';
import {keyLevels,migrateLevels} from './liquidity.js';
import {marketState,balance,exhaustion} from './marketState.js';
import {riskPlan} from './risk.js';
import {macro} from './macro.js';
import {rating} from './rating.js';
import {policy} from '../config/policy.js';
export function evaluate(input,previous=null,{durable=false}={}){
  const state=structuredClone(previous??freshState());if(state.version!==policy.version)throw Error('STATE_VERSION_MISMATCH');
  input=structuredClone(input);
  if(input.quote.at<(state.path.at(-1)?.at??0)){input.quote.fresh=false;input.source_errors.push('OUT_OF_ORDER_QUOTE');}
  const revised=input.m5.valid.some(b=>state.bars.some(old=>old.at===b.at&&['open','high','low','close'].some(k=>old[k]!==b[k])));
  if(revised){input.m5.flags.push('REVISED_CONFIRMED_BAR');if(state.candidate){state.candidate.stage='INVALIDATED';state.candidate.invalidation_reason='REVISED_CONFIRMED_BAR';}}
  const bootstrap=state.bootstrap;state.bootstrap=false;
  const newBars=input.m5.valid.filter(b=>b.end>state.watermark);
  for(const b of newBars)step(state,b);
  observeQuote(state,input.quote);
  if(state.candidate&&input.now-state.candidate.created_at>policy.setupExpiryBars*300000){state.candidate.stage='INVALIDATED';state.candidate.invalidation_reason='SETUP_EXPIRED_WALL_CLOCK';}
  if(bootstrap&&state.candidate?.retest)state.candidate.historical_retest=true;
  const c=state.candidate,levels=keyLevels(state.bars,input.quote,state.session),m15=input.m15.valid;
  levels.push(...migrateLevels(state,input.quote,input.now));
  if(m15.length){levels.push({type:'recent_M15_high',price:Math.max(...m15.map(b=>b.high)),available_at:m15.at(-1).end},{type:'recent_M15_low',price:Math.min(...m15.map(b=>b.low)),available_at:m15.at(-1).end});}
  const r=balance(state.bars)??c?.range,position=r&&r.high>r.low?(input.quote.price-r.low)/(r.high-r.low):null;
  const market=marketState(state.bars.length?state.bars:m15,c),mac=macro(input,c),last=state.bars.at(-1);
  const quality={quote_fresh:input.quote.fresh,m5_quality:input.m5.quality,m15_quality:input.m15.quality,
    confirmation_fresh:!revised&&!!last&&input.now-last.end<=policy.barMaxAgeMs&&state.bars.length>=3&&state.bars.slice(-3).every((b,i,a)=>!i||b.at===a[i-1].end),
    flags:[...input.m5.flags,...input.m15.flags],source_errors:input.source_errors,state_durable:durable};
  const plan=c?.plan??riskPlan(c,input.quote.price,levels.filter(l=>l.available_at<=input.now)),grade=rating({candidate:c,plan,quality,macro:mac,rangePosition:position,marketState:market,durable,now:input.now,bootstrap:bootstrap||!!c?.historical_retest});
  if(c&&(c.timing_missed||(input.quote.fresh&&missed(c,input.quote.price)))){c.timing_missed=true;grade.action='NO_TRADE';grade.rating='C';grade.reasons.push('ENTRY_MISSED_NO_CHASE');}
  if(grade.action==='ALLOW_ORDER'){c.plan=plan;c.stage='ACTIVE';c.activated_at=input.now;}
  if(c&&['ACTIVE','TP1','TP2'].includes(c.stage)&&grade.action!=='ALLOW_ORDER'&&quality.quote_fresh){grade.action='OBSERVE';grade.reasons.push('EXISTING_SIGNAL_NO_NEW_ORDER');}
  const output={state,result:{time:new Date(input.now).toISOString(),price:input.quote.price,market_state:market,model:c?.model??null,stage:c?.stage??'WAIT',bias:c?(c.direction==='BUY'?'LONG':'SHORT'):'NEUTRAL',
    ...grade,reason:grade.reasons,entry:plan.entry??null,stop_loss:plan.stop_loss??null,risk_usd:plan.risk_usd??null,tp1:plan.tp1??null,tp2:plan.tp2??null,rr1:plan.rr1??null,rr2:plan.rr2??null,
    extreme:c?.extreme??null,reclaim_level:c?.reclaim??null,trigger_level:c?.trigger??null,first_retest_zone:c?.retest??null,key_levels:levels,range_position:position,macro_bias:mac.bias,macro:mac,
    invalidation:c?[c.invalidation_reason??`Structural extreme ${c.extreme}`,`Retest stop ${plan.stop_loss??'UNDETERMINED'}`]:[],data_quality:quality,
    signal_id:c?.id??null,signal_only:true,order_executed:false,quote_basis:'JIN10_INDICATIVE_CLOSE',execution_costs_included:false,
    session_calendar:policy.sessionCalendar,confidence_kind:'RULE_COMPLETENESS_NOT_WIN_PROBABILITY',policy_version:policy.version,
    debug:{range:r??null,retest_count:c?.retest_count??0,evidence:c?.evidence??[],quote_path:state.path,previous_session:state.session.previous??null,
      exhaustion:{sell:exhaustion(state.bars,'BUY'),buy:exhaustion(state.bars,'SELL')},conditions:{quote_fresh:quality.quote_fresh,complete_bars:quality.confirmation_fresh,
        liquidity_event:!!c,structure_shift:!!c?.shift_at,first_retest:c?.retest_count===1&&!!c?.retest,stop_within_5:plan.risk_usd>0&&plan.risk_usd<=5,rr_at_least_2:plan.rr1>=2,durable_state:durable}}}};
  timing(state,output.result,input);
 Object.assign(output.result.debug.conditions,{key_zone_reached:!!c,sweep_detected:!!c?.evidence?.some(e=>['SWEEP_LOW','SWEEP_HIGH'].includes(e.event)),reclaim_confirmed:!!c?.evidence?.some(e=>e.event==='RECLAIM'),structure_shift_confirmed:!!c?.shift_at,stop_valid:plan.risk_usd>0&&plan.risk_usd<=5,rr_valid:plan.rr1>=2,middle_of_range:position!==null&&position>.35&&position<.65,macro_confirmation:mac.relation==='MACRO_CONFIRMATION',macro_failure:mac.relation==='MACRO_FAILURE'});
 return output;
}
