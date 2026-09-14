import {load} from '../data/jin10.js';
import {evaluate} from '../engine/index.js';
const input=await load(),{result}=evaluate(input);
console.log(JSON.stringify({quote_fresh:input.quote.fresh,m5_valid:input.m5.valid.length,m15_valid:input.m15.valid.length,
  m5_quality:input.m5.quality,m15_quality:input.m15.quality,source_errors:input.source_errors,action:result.action,
  bootstrap:true,durable:false,signal_only:true},null,2));
