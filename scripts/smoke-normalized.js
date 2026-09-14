import {quote,bars} from '../data/jin10.js';
import {evaluate} from '../engine/index.js';
let text='';for await(const chunk of process.stdin)text+=chunk;
const raw=JSON.parse(text.replace(/^\uFEFF/,'')),now=Date.now();
const input={now,quote:quote(raw.quote,now),m5:bars(raw.m5,'M5',now),m15:bars(raw.m15,'M15',now),calendar:raw.calendar,flashes:[raw.gold,raw.fed],source_errors:Object.keys(raw).filter(k=>raw[k]===null)};
const {result}=evaluate(input);
console.log(JSON.stringify({transport:'POWERSHELL_HTTPS_TO_NODE_NORMALIZER',quote_fresh:input.quote.fresh,m5_complete:input.m5.valid.length,m15_complete:input.m15.valid.length,m5_quality:input.m5.quality,m15_quality:input.m15.quality,
  macro_status:result.macro.status,action:result.action,source_errors:input.source_errors,flags:result.data_quality.flags,bootstrap:true,profitability_evaluated:false},null,2));
