// first_retest_v2: completed-bar evidence only, with no backdated confirmation.
export function retestStep(c,b){
 const long=c.direction==='BUY',inside=long?b.close<c.reclaim:b.close>c.reclaim;
 c.old_structure_closes=inside?(c.old_structure_closes??0)+1:0;
 if(c.old_structure_closes>=2)return 'OLD_STRUCTURE_REACCEPTED';
 if(c.retest&& (long?b.low<c.retest.low:b.high>c.retest.high))return 'RETEST_STRUCTURE_BROKEN';
 if(c.retest_count!==1||c.retest)return null;
 const held=long?b.close>c.trigger:b.close<c.trigger;
 const p=c.pending_retest;
 const rebound=p&&(long?b.low>p.low&&b.close>p.high:b.high<p.high&&b.close<p.low);
 if(!inside&&(held||rebound)){
  const low=p?Math.min(p.low,b.low):b.low,high=p?Math.max(p.high,b.high):b.high;
  c.retest={low,high,close:b.close,at:b.end,definition_version:'first_retest_v2',confirmation_basis:held?'TRIGGER_RECLAIM':'PULLBACK_REBOUND',entry_reference:b.close};
  c.stage='SIGNAL_READY';return 'CONFIRMED';
 }
 // Keep the pivot's own opposite edge: a later bar must break it to confirm HL/LH.
 if(!p||(long?b.low<=p.low:b.high>=p.high))c.pending_retest={low:b.low,high:b.high,at:b.end};
 c.stage='FIRST_RETEST';return null;
}
