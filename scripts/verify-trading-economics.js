import {loadTradingEconomics} from '../data/providers/trading-economics.js';
import {macroV2} from '../engine/macroV2.js';
const now=Date.now(),x=await loadTradingEconomics({now});
console.log(JSON.stringify({checked_at:new Date(now).toISOString(),status:x.status,symbols:x.symbols,snapshot:x.snapshot,validation:x.validation,macro:macroV2(x.facts,now)},null,2));
if(x.status!=='VERIFIED')process.exitCode=2;
