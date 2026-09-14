import {store} from '../state/store.js';
export function eventsHandler({repository}={}){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');if(req.method!=='GET')return res.status(405).json({error:'Method Not Allowed'});
 const values=new URL(req.url,'http://localhost').searchParams.getAll('limit'),value=values[0]??'50';
 if(values.length>1||!/^\d+$/.test(value)||Number(value)<1||Number(value)>200)return res.status(400).json({error:'LIMIT_MUST_BE_1_TO_200'});
 try{const s=repository??store();if(!s.durable)throw Error();const raw=await s.read(),state=raw?JSON.parse(raw):null;return res.status(200).json({events:(state?.transitions??[]).slice(-Number(value)).reverse(),current_state:state?.latest_result?.stage??null,updated_at:state?.updated_at??null,state_version:state?.revision??null,last_watch:state?.last_watch??null,signal_only:true});}
 catch{return res.status(503).json({events:[],action:'NO_TRADE',error:'STATE_STORE_UNAVAILABLE'});}
};}
