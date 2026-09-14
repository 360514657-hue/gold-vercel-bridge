import {macroFilterPolicy as p} from '../config/macro-policy.js';
import {timestamp} from '../data/jin10.js';
export function eventRisk(calendar,now){
 const rows=calendar?.data,known=calendar?.ok===true&&Array.isArray(rows),events=[];let malformed=false;
 for(const e of known?rows:[]){const title=String(e.title??''),important=Number(e.star)>=3||/FOMC|Powell|鲍威尔/i.test(title);if(!important||!/美国|美联储|FOMC|Powell|鲍威尔|\bUS\b|United States/i.test(title))continue;
 const at=timestamp(e.pub_time);if(!Number.isFinite(at)){malformed=true;continue;}if(now>=at-p.eventBeforeMs&&now<=at+p.eventAfterMs)events.push({title,at});
 }
 return {known:known&&!malformed,blocked:!known||malformed||events.length>0,events,before_ms:p.eventBeforeMs,after_ms:p.eventAfterMs};
}
export function macroFilter(input){
 const d=input.dxy,valid=d?.valid===true&&d.provider==='ITICK'&&Number.isFinite(d.available_at)&&d.available_at<=input.now&&Number.isFinite(d.at)&&d.at<=input.now&&input.now-d.at<=p.referenceToleranceMs&&Number.isFinite(d.move_5m_pct)&&Number.isFinite(d.move_15m_pct)&&d.fresh===true&&Number.isFinite(Date.parse(d.timestamp))&&Date.parse(d.timestamp)<=input.now&&input.now-Date.parse(d.timestamp)<=p.quoteMaxAgeMs;
 const bear=valid&&d.move_15m_pct>=p.DXY_15M_BEARISH_GOLD&&d.move_5m_pct>=-p.MAX_5M_COUNTER_MOVE;
 const bull=valid&&d.move_15m_pct<=p.DXY_15M_BULLISH_GOLD&&d.move_5m_pct<=p.MAX_5M_COUNTER_MOVE;
 return {version:p.version,bias:bear?'BEARISH':bull?'BULLISH':'NEUTRAL',score:bear?-100:bull?100:0,quality:valid?'GOOD':'MISSING',acceptable:valid,strong:bear||bull,components:{DXY:d??null},events:eventRisk(input.calendar,input.now),scope:'DXY_ONLY',method:p.version};
}
