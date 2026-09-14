import {signal,scanner} from './signal.js';
export function endpoint(view,{run=signal}={}){return async function(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Cache-Control','no-store, no-cache, must-revalidate');
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');res.setHeader('Access-Control-Allow-Headers','*');return res.status(204).end();}
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'Method Not Allowed'});
  try{const result=await run();if(view==='scanner')return res.status(200).json(scanner(result));
    if(view==='debug')return res.status(200).json(result);
    const {debug,...publicResult}=result;return res.status(200).json(publicResult);
  }catch{return res.status(503).json({ok:false,action:'NO_TRADE',error:'SIGNAL_TEMPORARILY_UNAVAILABLE',signal_only:true});}
};}
