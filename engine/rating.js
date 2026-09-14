export function rating({candidate,plan,quality,macro,rangePosition,marketState,durable,now,bootstrap}){
  const reasons=[];
  if(!quality.quote_fresh)reasons.push('QUOTE_NOT_FRESH');
  if(!candidate||candidate.stage==='INVALIDATED')return {rating:'C',action:'NO_TRADE',confidence:0,reasons:[...reasons,'NO_VALID_SETUP']};
  if(!durable)reasons.push('DURABLE_STATE_REQUIRED');
  if(!quality.confirmation_fresh)reasons.push('CONFIRMATION_BARS_STALE_OR_GAPPED');
  if(bootstrap)reasons.push('BOOTSTRAP_OBSERVATION_ONLY');
  if(candidate.retest_count>=3)reasons.push('THIRD_RETEST_FORBIDDEN');
  if(rangePosition>.35&&rangePosition<.65&&!['TREND_UP','TREND_DOWN'].includes(marketState)&&!candidate.shift_at)reasons.push('RANGE_MIDDLE');
  if(macro.event_risk)reasons.push('HIGH_IMPACT_EVENT_WINDOW');
  if(candidate.expires_at&&now>candidate.expires_at)reasons.push('SIGNAL_EXPIRED');
  const ready=candidate.stage==='SIGNAL_READY'&&candidate.shift_at&&candidate.retest;
  if(!ready)return {rating:'B',action:reasons.includes('QUOTE_NOT_FRESH')?'NO_TRADE':'OBSERVE',confidence:35,reasons:[...reasons,'STRUCTURE_OR_RETEST_PENDING']};
  if(!plan.ok)reasons.push(plan.reason);
  if(reasons.length)return {rating:plan.ok?'B':'C',action:plan.ok&&!reasons.includes('QUOTE_NOT_FRESH')?'OBSERVE':'NO_TRADE',confidence:25,reasons};
  if(candidate.retest_count>1)return {rating:'B',action:'OBSERVE',confidence:50,reasons:['SECOND_RETEST_DOWNGRADED']};
  const top=plan.rr1>=2.5&&macro.relation!=='NONE'&&macro.status==='AVAILABLE'&&quality.m5_quality==='GOOD'&&quality.m15_quality==='GOOD';
  return {rating:top?'A+':'A',action:'ALLOW_ORDER',confidence:top?85:quality.m5_quality==='GOOD'&&quality.m15_quality==='GOOD'?75:60,reasons:['COMPLETE_STRUCTURE_FIRST_RETEST_RISK_PASS']};
}
