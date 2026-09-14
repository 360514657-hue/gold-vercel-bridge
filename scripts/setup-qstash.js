import {watchDestination,PREVIEW_WATCH_URL} from '../config/watch.js';
import {Client} from '@upstash/qstash';
const env=process.env;
if(!env.QSTASH_TOKEN||!env.QSTASH_CURRENT_SIGNING_KEY||!env.QSTASH_NEXT_SIGNING_KEY){console.log('NOT_CONFIGURED: QStash credentials required');process.exit(2);}
// Require explicit Preview selection. Never infer a production host or create schedules during a build.
if(env.WATCH_TARGET_ENV!=='preview'){console.log('REFUSED: WATCH_TARGET_ENV must be preview');process.exit(2);}
const url=new URL(watchDestination(env));
if(url.href!==PREVIEW_WATCH_URL||url.protocol!=='https:'||url.pathname!=='/api/watch/xauusd'||url.search||url.username||url.password){console.log('REFUSED: invalid watcher destination');process.exit(2);}
try{
 const client=new Client({token:env.QSTASH_TOKEN,...(env.QSTASH_URL?{baseUrl:env.QSTASH_URL}:{})});
 if(!env.VERCEL_AUTOMATION_BYPASS_SECRET){console.log('NOT_CONFIGURED: existing automation bypass secret required');process.exit(2);}
 const headers={'Content-Type':'application/json'};
 if(env.VERCEL_AUTOMATION_BYPASS_SECRET)headers['x-vercel-protection-bypass']=env.VERCEL_AUTOMATION_BYPASS_SECRET;
 const x=await client.schedules.create({destination:url.href,scheduleId:'gold-xauusd-preview-watcher',cron:'* * * * *',method:'POST',body:'{}',headers,retries:0});
 console.log(JSON.stringify({configured:true,schedule_id:x.scheduleId,cron:'* * * * *',delivery_verified:false}));
}catch{console.log('QSTASH_SETUP_FAILED');process.exitCode=1;}
