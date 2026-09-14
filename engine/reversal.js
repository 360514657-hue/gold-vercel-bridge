import {swings} from './structure.js';
import {balance,exhaustion} from './marketState.js';
import {sweep} from './liquidity.js';
import {policy} from '../config/policy.js';
export function reversal(prior,b){
  const s=swings(prior),range=balance(prior);
  for(const direction of ['BUY','SELL']){
    const long=direction==='BUY',sign=long?1:-1,structure=long?s.high:s.low,trigger=structure.at(-1);
    if(structure.length<2 || (long?trigger.price>=structure.at(-2).price:trigger.price<=structure.at(-2).price))continue;
    const anchor=(long?s.low:s.high).at(-1),level=range?(long?range.low:range.high):anchor?.price;
    if(!trigger||!Number.isFinite(level)||!sweep(b,level,direction))continue;
    if(trigger.available_at>b.at||(anchor&&!range&&anchor.available_at>b.at))continue;
    const pre=range?prior.filter(r=>r.at<range.start):prior;
    const tail=pre.slice(-3),moves=tail.map(r=>sign*(r.open-r.close)),tr=tail.map(r=>r.high-r.low);
    const v=tail.length===3&&moves.every(x=>x>0)&&moves[2]>=moves[0]*policy.vAcceleration&&moves.reduce((a,x)=>a+x,0)>=tr.reduce((a,x)=>a+x,0)/3*policy.vDistanceTR;
    const down=pre.length>=3&&sign*(pre.at(-3).open-pre.at(-1).close)>0;
    const exhausted=exhaustion(pre,direction);
    const model=range&&down&&exhausted.present?(long?'R1':'R2'):!range&&v?(long?'V1':'V2'):null;
    if(!model)continue;
    return {model,direction,stage:'RECLAIM',liquidity:level,reclaim:level,trigger:trigger.price,broken_swing_id:trigger.id,
      extreme:long?b.low:b.high,created_at:b.end,event_at:b.end,range,exhaustion:exhausted,
      evidence:[{event:long?'SWEEP_LOW':'SWEEP_HIGH',at:b.end,bar_at:b.at},{event:'RECLAIM',at:b.end,bar_at:b.at}],retest_count:0};
  }
  return null;
}
