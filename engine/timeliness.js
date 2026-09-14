// Execution timing overlay; structural detectors remain unchanged.
import {policy,round} from '../config/policy.js';
export const executionVersion='execution_v1';
export function chaseLimit(){const x=Number(process.env.MAX_CHASE_DISTANCE_USD??2);if(!Number.isFinite(x)||x<0)throw Error('INVALID_CHASE_CONFIG');return x;}
export function timing(state,result,input){
 const c=state.candidate,price=input.quote.price;result.execution_version=executionVersion;result.max_chase_distance_usd=chaseLimit();
 if(!input.quote.fresh)return;
 if(c?.timing_missed){result.stage='MISSED';result.action='NO_TRADE';result.rating='C';result.reason.push('ENTRY_MISSED_NO_CHASE');return;}
 if(result.action==='ALLOW_ORDER'){result.stage='SIGNAL_READY';return;}
 if(c&&['RECLAIM','BREAKOUT_TEST','STRUCTURE_SHIFT','FIRST_RETEST'].includes(c.stage)){
  const sign=c.direction==='BUY'?1:-1,stop=round(c.extreme-sign*policy.tick);
  const targets=[...new Set(result.key_levels.filter(l=>l.available_at<=input.now).map(l=>l.price))].filter(x=>sign*(x-c.trigger)>0).sort((a,b)=>sign*(a-b));
  c.armed_plan??={entry:{low:c.trigger,high:c.trigger},stop_loss:stop,tp1:targets[0]??null,tp2:targets[1]??null,basis:'PROVISIONAL_EXTREME_PENDING_FIRST_RETEST'};
  result.stage='ARMED';result.action='OBSERVE';result.provisional_plan=c.armed_plan;result.expected_entry_zone=c.armed_plan.entry;
  if(!result.entry){result.entry=c.armed_plan.entry;result.stop_loss=c.armed_plan.stop_loss;result.tp1=c.armed_plan.tp1;result.tp2=c.armed_plan.tp2;}
  result.reason.push('PROVISIONAL_PLAN_NOT_EXECUTABLE');return;
 }
 if(!c){const near=result.key_levels.filter(l=>Number.isFinite(l.price)&&l.available_at<=input.now&&Math.abs(l.price-price)<=3).sort((a,b)=>Math.abs(a.price-price)-Math.abs(b.price-price))[0];
  if(near){result.stage='PREPARE';result.action='OBSERVE';result.possible_model=near.price>=price?['R2','V2']:['R1','V1'];result.trigger_level=near.price;result.expected_entry_zone=null;result.reason.push('NEAR_LEVEL_STRUCTURE_PENDING');}}
}
export function missed(c,price){if(!c?.retest||c.activated_at||c.stage==='INVALIDATED')return false;const reference=c.retest.entry_reference??c.trigger;const edge=c.direction==='BUY'?Math.max(reference,c.retest.close):Math.min(reference,c.retest.close);return (c.direction==='BUY'?price-edge:edge-price)>chaseLimit();}
