export function structureAudit(c,bars=[]){
 const ev=c?.evidence??[],find=(...names)=>ev.find(e=>names.includes(e.event)),b=e=>bars.find(b=>b.at===e?.bar_at),item=(ok,e,price,reference)=>({value:!!ok,timestamp:ok?e?.at??null:null,price:ok?price??null:null,reference_level:reference??null});
 const sw=find('SWEEP_LOW','SWEEP_HIGH'),re=find('RECLAIM'),shift=find('STRUCTURE_SHIFT'),rt=find('FIRST_RETEST');
 return {KEY_ZONE:item(Number.isFinite(c?.liquidity),{at:c?.event_at},c?.liquidity,c?.liquidity),SWEEP:item(sw,sw,c?.direction==='BUY'?b(sw)?.low:b(sw)?.high,c?.liquidity),RECLAIM:item(re,re,b(re)?.close,c?.reclaim),STRUCTURE_SHIFT:item(shift,shift,b(shift)?.close,c?.trigger),FIRST_RETEST:item(rt&&c?.retest_count===1,rt,c?.retest?.close,c?.trigger),EXECUTION:item(c?.stage==='ACTIVE',{at:c?.activated_at},c?.retest?.close,c?.trigger),quote_basis:'JIN10_INDICATIVE_BARS_NOT_EXCHANGE_FILL_PROOF',model:c?.model??null};
}
