import {policy} from '../config/policy.js';
import {trend} from './structure.js';
export function balance(bars){
  const b=bars.slice(-policy.balanceBars);if(b.length<policy.balanceBars||b.some((r,i)=>i&&r.at!==b[i-1].end))return null;
  const high=Math.max(...b.map(r=>r.high)),low=Math.min(...b.map(r=>r.low)),width=high-low;
  if(width<=0||Math.abs(b.at(-1).close-b[0].open)>width*policy.balanceDrift)return null;
  if(b.filter(r=>r.high>=high-width*.25).length<2||b.filter(r=>r.low<=low+width*.25).length<2)return null;
  if(b.reduce((s,r)=>s+Math.abs(r.close-r.open),0)/b.length>width*policy.balanceBody)return null;
  return {high,low,available_at:b.at(-1).end,start:b[0].at};
}
export function exhaustion(bars,direction){
  const sign=direction==='BUY'?-1:1,ext=[],rebounds=[];let record=null;
  for(const b of bars){const p=sign===-1?b.low:b.high;
    if(record!==null&&sign*(p-record)>0){ext.push(sign*(p-record));rebounds.push(sign===-1?b.close-b.low:b.high-b.close);}
    if(record===null||sign*(p-record)>0)record=p;
  }
  const e=ext.slice(-3),r=rebounds.slice(-3);
  return {present:e.length===3&&e[0]>e[1]&&e[1]>e[2]&&r[0]<r[1]&&r[1]<r[2],extensions:e,rebounds:r};
}
export function marketState(bars,candidate){
  if(candidate){if(candidate.stage==='SIGNAL_READY'||candidate.stage==='FIRST_RETEST')return 'BREAKOUT_TEST';
    if(candidate.model[0]==='V')return candidate.direction==='BUY'?'POTENTIAL_V_BOTTOM':'POTENTIAL_V_TOP';
    if(candidate.model[0]==='C')return candidate.direction==='BUY'?'EXPANSION_UP':'EXPANSION_DOWN';}
  return balance(bars)?'BALANCE':trend(bars);
}
