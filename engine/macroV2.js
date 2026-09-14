import {executionPolicy as p} from '../config/execution.js';
export function macroV2(facts={},now){
 const components={};let score=0;
 for(const [name,weight] of Object.entries(p.weights)){
 const f=facts[name];
 const valid=f?.verified===true&&f.execution_eligible===true&&typeof f.provider==='string'&&Number.isFinite(f.available_at)&&f.available_at<=now&&now-f.available_at<=p.macroMaxAgeMs&&Number.isFinite(f.at)&&f.at<=f.available_at&&now-f.at<=p.macroMaxAgeMs&&Number.isFinite(f.reference_at)&&f.reference_at<f.at&&Number.isFinite(f.value)&&Number.isFinite(f.reference);
 // Numeric yields / DXY / rate expectations rising are negative gold contributions.
 // Surprise/risk adapters must supply an independently verified rate-pressure measure.
 const contribution=valid?-Math.sign(f.value-f.reference)*weight:0;
 components[name]={valid,contribution,weight,provider:f?.provider??null,reason:valid?'OBSERVED_NUMERIC_CHANGE':f?.reason??'VERIFIED_DATA_REQUIRED'};score+=contribution;
 }
 const critical=p.critical.every(k=>components[k].valid),any=Object.values(components).some(x=>x.valid);
 return {score,bias:!critical?'NEUTRAL':score>=p.macroThreshold?'BULLISH':score<=-p.macroThreshold?'BEARISH':'NEUTRAL',quality:!any?'MISSING':Object.values(components).every(x=>x.valid)?'GOOD':'PARTIAL',acceptable:critical,components,method:'VERIFIED_NUMERIC_RATE_PRESSURE_V2'};
}
