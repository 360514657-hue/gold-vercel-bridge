import {swings} from './structure.js';
import {balance} from './marketState.js';
export function keyLevels(bars,quote,session={}){
  const s=swings(bars),r=balance(bars),levels=[];
  const add=(type,price,available_at)=>{if(Number.isFinite(price))levels.push({type,price,available_at,object_type:'LEVEL'});};
  for(const type of ['day_open','day_high','day_low'])add(type,quote[type],quote.at);
  add('previous_session_high',session.previous?.high,session.previous?.ended_at);add('previous_session_low',session.previous?.low,session.previous?.ended_at);
  for(const side of ['high','low'])for(const v of s[side])add(`swing_${side}`,v.price,v.available_at);
  add('recent_swing_high',s.high.at(-1)?.price,s.high.at(-1)?.available_at);add('recent_swing_low',s.low.at(-1)?.price,s.low.at(-1)?.available_at);
  if(s.high.length>1&&s.high.at(-1).price<s.high.at(-2).price)add('recent_M5_lower_high',s.high.at(-1).price,s.high.at(-1).available_at);
  if(s.low.length>1&&s.low.at(-1).price>s.low.at(-2).price)add('recent_M5_higher_low',s.low.at(-1).price,s.low.at(-1).available_at);
  if(r){add('range_high',r.high,r.available_at);add('range_low',r.low,r.available_at);}
  add('liquidity_high',r?.high??s.high.at(-1)?.price,r?.available_at??s.high.at(-1)?.available_at);
  add('liquidity_low',r?.low??s.low.at(-1)?.price,r?.available_at??s.low.at(-1)?.available_at);
  return levels;
}
export function sweep(bar,level,direction){return direction==='BUY'?bar.low<level&&bar.close>level:bar.high>level&&bar.close<level;}
export function migrateLevels(state,quote,now){
  state.level_history??=[];
  if(quote.fresh)for(const type of ['day_high','day_low','day_open']){
    const price=quote[type];if(!Number.isFinite(price))continue;
    const day=Math.floor(quote.at/86400000),id=`${day}:${type}:${price}`;
    if(!state.level_history.some(l=>l.id===id))state.level_history.push({id,type,price,available_at:now,role:type==='day_high'?'RESISTANCE':type==='day_low'?'SUPPORT':'ANCHOR',object_type:'LEVEL'});
  }
  for(const l of state.level_history){
    const subsequent=state.bars.filter(b=>b.at>=l.available_at).slice(-2);
    if(subsequent.length!==2||subsequent[0].end!==subsequent[1].at)continue;
    if(l.role==='RESISTANCE'&&subsequent.every(b=>b.close>l.price)){l.role='SUPPORT_CANDIDATE';l.accepted_at=subsequent[1].end;}
    if(l.role==='SUPPORT'&&subsequent.every(b=>b.close<l.price)){l.role='RESISTANCE_CANDIDATE';l.accepted_at=subsequent[1].end;}
  }
  state.level_history=state.level_history.filter(l=>now-l.available_at<=86400000).slice(-90);
  return state.level_history;
}
