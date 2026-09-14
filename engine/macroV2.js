import {macroMarketPolicy as p} from '../config/macro-market.js';
const finite=x=>typeof x==='number'&&Number.isFinite(x);
export function macroV2(facts={},now){
 const components={};let score=0,timingScore=0;
 for(const [name,weight] of Object.entries(p.weights)){
 const f=facts[name];
 const valid=f?.verified===true&&f.execution_eligible===true&&typeof f.provider==='string'&&finite(f.available_at)&&f.available_at<=now&&finite(f.at)&&f.at<=f.available_at&&now-f.at<=p.maxAgeMs&&[f.value,f.reference_5m,f.reference_15m].every(x=>finite(x)&&x>0)&&[5,15].every(m=>finite(f['reference_'+m+'m_at'])&&f.at-f['reference_'+m+'m_at']>=m*60000&&f.at-f['reference_'+m+'m_at']<=m*60000+p.referenceToleranceMs);
 const change=m=>!valid?null:name==='DXY'?(f.value/f['reference_'+m+'m']-1)*100:(f.value-f['reference_'+m+'m'])*100;
 const m5=change(5),m15=change(15),direction=(x,n)=>x===null||Math.abs(x)<n?0:Math.sign(x),d5=direction(m5,p.noise[name].m5),d15=direction(m15,p.noise[name].m15);
 // 15m is direction; a contrary 5m move vetoes that component. Flat 5m is allowed.
 const signal=valid&&d15!==0&&d5!==-d15?-d15:0,contribution=signal*weight;
 components[name]={valid,weight,signal,contribution,direction_5m:d5,direction_15m:d15,...(name==='DXY'?{move_5m_pct:m5,move_15m_pct:m15}:{move_5m_bp:m5,move_15m_bp:m15}),reason:valid?'VERIFIED_MULTI_HORIZON_CHANGE':f?.reason??'VERIFIED_INTRADAY_REQUIRED'};
 score+=contribution;timingScore+=valid?-d5*weight:0;
 }
 const count=Object.values(components).filter(x=>x.valid).length,acceptable=count===3;
 const bias=!acceptable?'NEUTRAL':score>=p.threshold?'BULLISH':score<=-p.threshold?'BEARISH':'NEUTRAL';
 const direction=bias==='BEARISH'?1:bias==='BULLISH'?-1:0;
 // Strict majority of two bonds means both 15m directions; 5m uses weighted confirmation.
 const strong=acceptable&&direction!==0&&components.DXY.direction_15m===direction&&['US2Y','US10Y'].filter(k=>components[k].direction_15m===direction).length>1&&components.DXY.direction_5m!==-direction&&-direction*timingScore>=p.strongTimingWeight;
 return {score,bias,quality:count===3?'GOOD':count?'PARTIAL':'MISSING',acceptable,strong,components,timing_score:timingScore,method:p.version};
}
