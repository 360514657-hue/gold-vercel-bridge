import {store} from '../state/store.js';import {alertView} from '../notifications/alerts.js';import {noExecution} from '../engine/execution.js';
const epoch='1970-01-01T00:00:00.000Z';
export function alertsHandler({repository,now=()=>Date.now()}={}){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');const fallback=time=>alertView(noExecution(),time??epoch,null);
 if(req.method!=='GET')return res.status(405).json(fallback());
 try{const repo=repository??store();if(!repo.durable)throw Error();const raw=await repo.read(),state=raw?JSON.parse(raw):null,a=state?.latest_alert;
 const time=state?.alert_updated_at??a?.updated_at??(Number.isFinite(a?.created_at)?new Date(a.created_at).toISOString():epoch),watchAt=Date.parse(state?.last_watch?.at),stale=!Number.isFinite(watchAt)||watchAt>now()||now()-watchAt>120000;
 if(!a||stale)return res.status(503).json(fallback(time));
 const c=a.contract??a;const valid=['BULLISH','BEARISH','NEUTRAL'].includes(c.macro)&&['BUY','SELL','NONE'].includes(c.side)&&['entry','stop_loss','take_profit'].every(k=>c.side==='NONE'?c[k]===null:Number.isFinite(c[k])&&c[k]>0);
 if(!valid||!Number.isFinite(Date.parse(time)))throw Error();
 return res.status(200).json(alertView(c,time,a.signal_id??null));
 }catch{return res.status(503).json(fallback());}
};}
