import {loadTradingEconomics} from '../data/providers/trading-economics.js';
export function macroMarketHandler({loader=loadTradingEconomics}={}){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='GET')return res.status(405).json({error:'METHOD_NOT_ALLOWED'});
 try{const {snapshot}=await loader();return res.status(200).json(snapshot);}
 catch{return res.status(503).json({error:'MACRO_MARKET_UNAVAILABLE'});}
};}
