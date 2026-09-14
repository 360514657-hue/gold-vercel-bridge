import {timestamp} from '../data/jin10.js';
import {policy} from '../config/policy.js';
const keywords=/Fed|CPI|PCE|NFP|美联储|非农|就业|通胀|美元|美债|收益率|地缘|油价|风险/i;
export function macro(input,candidate){
  const evidence=[],seen=new Set();let bull=false,bear=false;
  for(const payload of input.flashes??[]){
    const rows=Array.isArray(payload?.data)?payload.data:payload?.data?.items??[];
    for(const x of rows){const at=timestamp(x.time??x.pub_time),text=String(x.content??x.title??''),id=x.url??`${at}:${text}`;
      if(seen.has(id)||!Number.isFinite(at)||at>input.now||input.now-at>policy.macroTTL||!keywords.test(text))continue;seen.add(id);
      // Do not infer directional surprises from generic affect_txt or topic names.
      const uncertain=/可能|如果|预计|预测|不利多|不利空|并非/.test(text);
      const b=!uncertain&&/利多黄金|利好黄金/.test(text),s=!uncertain&&/利空黄金/.test(text);
      bull ||= b;bear ||= s;evidence.push({reference:id,available_at:at,topic_match:true,direction:b?'BULLISH_GOLD':s?'BEARISH_GOLD':'UNCLASSIFIED',text:text.slice(0,300)});
    }
  }
  const bias=bull&&bear?'MIXED':bull?'BULLISH_GOLD':bear?'BEARISH_GOLD':'NEUTRAL';
  const prior=evidence.filter(e=>candidate&&e.available_at<=candidate.event_at&&e.direction!=='UNCLASSIFIED');
  const supportive=candidate&&(candidate.direction==='BUY'?'BULLISH_GOLD':'BEARISH_GOLD');
  const confirmed=prior.some(e=>e.direction===supportive)&&bias===supportive;
  const failure=prior.length>0&&bias!=='MIXED'&&bias!=='NEUTRAL'&&bias!==supportive&&candidate?.model[0]!=='C'&&candidate?.evidence.some(e=>e.event==='RECLAIM');
  const calendar=Array.isArray(input.calendar?.data)?input.calendar.data:[];
  const scheduled=calendar.filter(e=>/美国|美联储|FOMC|Powell/i.test(e.title??'')&&keywords.test(e.title??'')&&Number(e.star)>=3).map(e=>({title:e.title,at:timestamp(e.pub_time)})).filter(e=>Number.isFinite(e.at));
  return {bias,evidence,scheduled,event_risk:scheduled.some(e=>Math.abs(e.at-input.now)<=policy.eventWindow),
    relation:confirmed?'MACRO_CONFIRMATION':failure?'MACRO_FAILURE':'NONE',
    status:input.calendar?.ok&&input.flashes?.every(p=>p?.ok)?'AVAILABLE':'PARTIAL',method:'EXPLICIT_TEXT_HEURISTIC_NOT_PIT_VALIDATION'};
}
