import {watchDestination} from '../config/watch.js';
import {Receiver} from '@upstash/qstash';
import {signal} from './signal.js';
export async function signedRequest(req,env=process.env){
 const currentSigningKey=env.QSTASH_CURRENT_SIGNING_KEY,nextSigningKey=env.QSTASH_NEXT_SIGNING_KEY,url=watchDestination(env);
 if(!currentSigningKey||!nextSigningKey||!url)throw Error('WATCH_CONFIG_REQUIRED');
 const destination=new URL(url);if(destination.protocol!=='https:'||destination.pathname!=='/api/watch/xauusd'||destination.search)throw Error('WATCH_CONFIG_REQUIRED');
 const signature=req.headers['upstash-signature'];if(typeof signature!=='string'){req.qstashFailure='SIGNATURE_MISSING';return false;}
 // Raw bytes are essential: do not reconstruct parsed JSON before verifying.
 const chunks=[];let size=0;for await(const chunk of req){const b=Buffer.from(chunk);size+=b.length;if(size>16384)return false;chunks.push(b);}
 try{return await new Receiver({currentSigningKey,nextSigningKey,devMode:false}).verify({signature,body:Buffer.concat(chunks).toString('utf8'),url,clockTolerance:0});}catch(error){const message=String(error?.message??'');req.qstashFailure=/subject/i.test(message)?'DESTINATION_MISMATCH':/body hash/i.test(message)?'BODY_HASH_MISMATCH':/exp|nbf|timestamp/i.test(message)?'TOKEN_TIME_INVALID':/signature verification/i.test(message)?'SIGNING_KEY_MISMATCH':'SIGNATURE_VERIFICATION_FAILED';return false;}
}
export function watchHandler({verify=signedRequest,run=()=>signal({requireDurable:true}),logger=x=>console.log(JSON.stringify(x))}={}){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');if(req.method!=='POST')return res.status(405).json({error:'Method Not Allowed'});
 try{if(!await verify(req))return res.status(401).json({error:'INVALID_QSTASH_SIGNATURE',diagnostic:req.qstashFailure??'SIGNATURE_VERIFICATION_FAILED'});}catch{return res.status(503).json({action:'NO_TRADE',stage:'DEGRADED',error:'WATCH_CONFIG_REQUIRED'});}
 try{const x=await run();return res.status(200).json({ok:true,execution:x.execution,stage:x.stage,action:x.action,signal_id:x.signal_id,time:x.time,state_version:x.debug?.persistence?.state_version??null,updated_at:x.debug?.persistence?.updated_at??null,signal_only:true,order_executed:false});}
 catch{logger({stage:'DEGRADED',action:'NO_TRADE',reason:'WATCH_STATE_OR_DATA_UNAVAILABLE',timestamp:new Date().toISOString()});return res.status(503).json({ok:false,stage:'DEGRADED',action:'NO_TRADE',error:'WATCH_STATE_OR_DATA_UNAVAILABLE',signal_only:true,order_executed:false});}
};}
