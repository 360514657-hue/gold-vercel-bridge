import {balance} from './marketState.js';
export function continuation(prior,b){
  const r=balance(prior);if(!r||r.available_at>b.at)return null;
  const direction=b.close>r.high?'BUY':b.close<r.low?'SELL':null;if(!direction)return null;
  const long=direction==='BUY',level=long?r.high:r.low;
  return {model:long?'C1':'C2',direction,stage:'BREAKOUT_TEST',liquidity:level,reclaim:level,trigger:level,
    extreme:long?r.low:r.high,created_at:b.end,event_at:b.end,range:r,broken_swing_id:`RANGE:${r.start}`,
    evidence:[{event:'RANGE_BREAK',at:b.end,bar_at:b.at}],retest_count:0};
}
