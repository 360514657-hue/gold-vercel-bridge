import {probeBars} from '../data/providers/jin10-bars-probe.js';
import {discoverJin10} from '../data/providers/jin10-mcp.js';
try{const x=await discoverJin10({quotes:true});if(x.all_quotes_verified)x.bars=await probeBars(x.mapping);else x.bars_status='NOT_TESTED_QUOTES_NOT_ALL_VERIFIED';console.log(JSON.stringify(x,null,2));if(!x.all_quotes_verified)process.exitCode=2;}
catch(error){console.log(JSON.stringify({resource_read:false,error:error?.message==='JIN10_MCP_AUTH_REQUIRED'?'JIN10_MCP_AUTH_REQUIRED':'JIN10_RESOURCE_UNAVAILABLE'}));process.exitCode=2;}
