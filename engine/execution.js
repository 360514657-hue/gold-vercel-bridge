import {executionPolicy as p} from '../config/execution.js';
import {macroV2} from './macroV2.js';
const cents=x=>Math.round(x*100)/100;
export const noExecution=(macro='NEUTRAL')=>({macro,side:'NONE',entry:null,stop_loss:null,take_profit:null});
function volatility(rows,cutoff){
 const bars=rows.filter(b=>b.end<=cutoff).slice(-(p.atrPeriods+1));
 if(bars.length!==p.atrPeriods+1||bars.some((b,i)=>i&&b.at!==bars[i-1].end))return null;
 const tr=bars.slice(1).map((b,i)=>Math.max(b.high-b.low,Math.abs(b.high-bars[i].close),Math.abs(b.low-bars[i].close)));
 if(tr.some(x=>!Number.isFinite(x)||x<=0))return null;
 const atr=tr.reduce((a,b)=>a+b,0)/p.atrPeriods;
 return {atr,buffer:Math.min(p.maxBuffer,Math.max(p.minBuffer,atr*p.atrFactor)),method:'SMA_TRUE_RANGE_COMPLETE_M5_AT_CONFIRMATION'};
}
export function executionDecision(input,state,result){
 const mac=macroV2(input.macro_facts,input.now),c=state.candidate,long=c?.direction==='BUY',sign=long?1:-1;
 const events=c?.evidence??[],has=name=>events.some(e=>e.event===name&&e.at<=input.now);
 const structure={sweep:has(long?'SWEEP_LOW':'SWEEP_HIGH'),reclaim:has('RECLAIM'),shift:!!c?.shift_at&&c.shift_at<=input.now,first_retest:c?.retest_count===1&&!!c?.retest&&c.retest.at<=input.now,acceptance:has('ACCEPTANCE')};
 const reversal=structure.sweep&&structure.reclaim&&structure.shift&&structure.first_retest;
 const validStructure=structure.shift&&structure.first_retest&&(c?.model?.startsWith('C')?structure.acceptance:structure.sweep&&structure.reclaim);
 const aligned=(long&&mac.bias==='BULLISH')||(!long&&mac.bias==='BEARISH');
 const opposite=(long&&mac.bias==='BEARISH')||(!long&&mac.bias==='BULLISH');
 const failure=!!(mac.acceptable&&opposite&&reversal&&Number.isFinite(c?.liquidity));
 const permission=mac.bias==='NEUTRAL'?reversal:aligned||failure;
 const trend=long?result.market_state==='TREND_UP':result.market_state==='TREND_DOWN';
 const resonance=opposite&&!failure?'CONFLICT':aligned&&trend&&structure.first_retest&&result.data_quality?.confirmation_fresh&&mac.acceptable?'STRONG':permission?'NORMAL':'NONE';
 const entry=Number.isFinite(c?.retest?.close)?cents(c.retest.close):null,v=volatility(input.m5.valid,c?.retest?.at??-1);
 const extreme=long?c?.retest?.low:c?.retest?.high;
 // Round away from structure, never towards it to shrink risk.
 const rawStop=Number.isFinite(extreme)&&v?extreme-sign*v.buffer:null;
 const sl=rawStop===null?null:(long?Math.floor(rawStop*100):Math.ceil(rawStop*100))/100;
 const risk=entry!==null&&sl!==null?cents(sign*(entry-sl)):null;
 const targets=entry===null?[]:[...new Set((result.key_levels??[]).filter(l=>Number.isFinite(l.price)&&Number.isFinite(l.available_at)&&l.available_at<=c.retest.at&&sign*(cents(l.price)-entry)>0).map(l=>cents(l.price)))].sort((a,b)=>sign*(a-b));
 const t1=targets[0]??null,t2=targets[1]??null,rr1=risk>0&&t1!==null?sign*(t1-entry)/risk:null,rr2=risk>0&&t2!==null?sign*(t2-entry)/risk:null;
 const selected=resonance==='STRONG'&&rr1>=p.minRR&&rr2>=p.minRR?t2:t1;
 const booleans={quote_fresh:input.quote.fresh===true&&result.data_quality?.quote_fresh===true,durable_state:result.data_quality?.state_durable===true,macro_quality_acceptable:mac.acceptable,no_high_impact_event_window:input.calendar?.ok===true&&result.macro?.event_risk===false,valid_direction_permission:!!permission,valid_structure:!!validStructure,first_retest:structure.first_retest,unique_entry_valid:entry!==null&&entry>0&&Number.isFinite(input.quote.price),structural_stop_valid:!!v&&risk>0,risk_within_5:risk>0&&risk<=p.maxRisk,liquidity_target_exists:t1!==null,rr_valid:rr1!==null&&rr1>=p.minRR,not_missed:!c?.timing_missed&&result.stage!=='MISSED'&&entry!==null&&Math.abs(input.quote.price-entry)<=p.maxChase,live_price_not_invalidated:sl!==null&&t1!==null&&sign*(input.quote.price-sl)>0&&sign*(t1-input.quote.price)>0,not_duplicate:!state.execution_closed_ids?.includes(c?.id),setup_live:!!c&&['SIGNAL_READY','ACTIVE'].includes(c.stage)&&(!c.expires_at||input.now<=c.expires_at)&&!c.historical_retest,confirmation_fresh:result.data_quality?.confirmation_fresh===true,structure_not_invalidated:!c?.invalidation_reason};
 const contract=Object.values(booleans).every(Boolean)?{macro:mac.bias,side:long?'BUY':'SELL',entry,stop_loss:sl,take_profit:selected}:noExecution(mac.bias);
 return {contract,debug:{version:p.version,macro_score:mac.score,macro_components:mac.components,macro_quality:mac.quality,macro_failure:failure,resonance,structure,entry_basis:'CONFIRMED_FIRST_RETEST_BAR_CLOSE',stop_basis:'CONFIRMED_RETEST_EXTREME_PLUS_CLAMPED_ATR_BUFFER',volatility_buffer:v?.buffer??null,volatility_method:v?.method??'UNAVAILABLE',target1:t1,target2:t2,selected_target:selected,rr: selected===t2?rr2:rr1,rr1,rr2,risk_usd:risk,booleans}};
}
export function persistExecution(state,before,decision,now){
 const prior=before?.execution_contract??noExecution(),next=decision.contract;
 const material=x=>JSON.stringify([x.side,x.entry,x.stop_loss,x.take_profit]);
 const changed=material(prior)!==material(next);
 state.execution_events=before?.execution_events??[];
 if(changed){state.execution_events=[...state.execution_events,{timestamp:new Date(now).toISOString(),previous:prior,current:next,signal_id:state.candidate?.id??before?.candidate?.id??null}].slice(-200);}
 state.execution_contract=next;
 // A withdrawn signal cannot be reissued after a later recovery on the same candidate.
 state.execution_closed_ids=before?.execution_closed_ids??[];
 if(prior.side!=='NONE'&&next.side==='NONE'&&before?.candidate?.id)state.execution_closed_ids=[...new Set([...state.execution_closed_ids,before.candidate.id])].slice(-200);
}
