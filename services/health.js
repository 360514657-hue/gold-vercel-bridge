import {loadItickDxy} from '../data/providers/itick.js';
import {emailConfiguration} from '../notifications/email.js';
import {store} from '../state/store.js';
import {quote} from '../data/jin10.js';
export async function health({repository,fetcher=fetch,now=Date.now()}={}){
 const result={app_ok:true,itick_ok:false,dxy_fresh:false,xau_quote_fresh:false,watcher_recent:false,email_configured:emailConfiguration().configured,email_missing:emailConfiguration().missing,jin10_ok:false,quote_fresh:false,redis_ok:false,state_storage_ok:false,latest_quote_time:null,latest_signal_time:null,current_state:null,deployment_version:process.env.VERCEL_GIT_COMMIT_SHA??'local-uncommitted',action:'NO_TRADE',reasons:[]};
 await Promise.all([
  (async()=>{const d=await loadItickDxy({fetcher,now});result.itick_ok=d.value!==null;result.dxy_fresh=d.valid;if(!d.valid)result.reasons.push(d.reason);})(),
  (async()=>{try{const s=repository??store(),raw=await s.read(),state=raw?JSON.parse(raw):null;result.redis_ok=s.durable;result.state_storage_ok=s.durable&&Number.isInteger(state?.revision)&&state.revision>0;result.current_state=state?.latest_result?.stage??null;result.watcher_recent=!!state?.last_watch&&now-Date.parse(state.last_watch.at)<=120000;result.last_watch=state?.last_watch??null;result.latest_signal_time=state?.latest_signal_time??null;if(!result.state_storage_ok)result.reasons.push('PERSISTED_STATE_NOT_VERIFIED');}catch{result.reasons.push('STATE_STORE_UNAVAILABLE');}})(),
  (async()=>{try{const r=await fetcher('https://gold.360514657.workers.dev/quote?code=XAUUSD',{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();const q=quote(await r.json(),now);result.jin10_ok=Number.isFinite(q.price)&&q.price>0;result.quote_fresh=q.fresh;result.xau_quote_fresh=q.fresh;result.latest_quote_time=Number.isFinite(q.at)?new Date(q.at).toISOString():null;if(!q.fresh)result.reasons.push('QUOTE_NOT_FRESH');}catch{result.reasons.push('JIN10_UNAVAILABLE');}})()
 ]);return result;
}
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');res.setHeader('Access-Control-Allow-Origin','*');if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');return res.status(204).end();}if(req.method!=='GET')return res.status(405).json({error:'Method Not Allowed'});return res.status(200).json(await health());}
