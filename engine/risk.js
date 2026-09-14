import {policy,round} from '../config/policy.js';
export function riskPlan(candidate,price,levels){
  if(!candidate?.retest)return {ok:false,reason:'NO_CONFIRMED_RETEST'};
  const long=candidate.direction==='BUY',sign=long?1:-1,r=candidate.retest;
  const stop=round((long?r.low:r.high)-sign*policy.tick),risk=round(sign*(price-stop));
  // Targets are actual observed levels. Never skip a nearer obstacle to inflate RR.
  const targets=[...new Set(levels.filter(l=>Number.isFinite(l.available_at)).map(l=>l.price))].filter(x=>sign*(x-price)>0).sort((a,b)=>sign*(a-b));
  const tp1=targets[0]??null,tp2=targets[1]??null,rr1=risk>0&&tp1!==null?sign*(tp1-price)/risk:null,rr2=risk>0&&tp2!==null?sign*(tp2-price)/risk:null;
  // Below-trigger rebound entries use the observed confirming bar's close.
  // No fabricated dollar-wide entry band; normal trigger reclaims retain their band.
  const reference=r.confirmation_basis==='PULLBACK_REBOUND'?r.entry_reference:candidate.trigger;
  let low=round(Math.min(reference,r.close)),high=round(Math.max(reference,r.close));
  // Every price advertised in the entry interval must satisfy the same policy,
  // not only the optimal/current quote. Restrict entry; never move the stop.
  if(long){low=Math.max(low,round(stop+policy.tick));high=Math.min(high,round(stop+policy.maxRisk));if(tp1!==null)high=Math.min(high,Math.floor((tp1+policy.minRR*stop)/(1+policy.minRR)*100)/100);}
  else {high=Math.min(high,round(stop-policy.tick));low=Math.max(low,round(stop-policy.maxRisk));if(tp1!==null)low=Math.max(low,Math.ceil((tp1+policy.minRR*stop)/(1+policy.minRR)*100)/100);}
  const reason=!(risk>0)?'INVALID_STOP_SIDE':risk>policy.maxRisk?'STRUCTURAL_STOP_EXCEEDS_5':tp1===null?'NO_LIQUIDITY_TARGET':rr1<policy.minRR?'RR_BELOW_2':price<low||price>high?'PRICE_OUTSIDE_RETEST_ENTRY':'RISK_PASS';
  return {ok:reason==='RISK_PASS',reason,entry:{low,high,optimal:price},stop_loss:stop,risk_usd:risk,tp1,tp2,rr1,rr2,
    preferred_stop:risk>=2.5&&risk<=4,stop_basis:'CONFIRMED_FIRST_RETEST_EXTREME_PLUS_ONE_PRICE_TICK',quote_basis:'JIN10_INDICATIVE_CLOSE',execution_costs_included:false};
}
