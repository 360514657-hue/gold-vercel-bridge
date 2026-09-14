import {signal} from './signal.js';
import {noExecution} from '../engine/execution.js';
export function executionHandler({run=signal}={}){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
 let status=200,contract=noExecution();
 if(req.method!=='GET')status=405;
 else try{const result=await run();contract=result.execution??noExecution();if(!['BULLISH','BEARISH','NEUTRAL'].includes(contract.macro)||!['BUY','SELL','NONE'].includes(contract.side)||!['entry','stop_loss','take_profit'].every(k=>contract.side==='NONE'?contract[k]===null:Number.isFinite(contract[k])&&contract[k]>0))throw Error();}catch{status=503;contract=noExecution();}
 // Numeric JSON literals with exactly two decimal places; no extra output fields.
 const x=contract;const price=n=>n===null?'null':n.toFixed(2);
 const body='{'+ '\"macro\":'+JSON.stringify(x.macro)+',\"side\":'+JSON.stringify(x.side)+',\"entry\":'+price(x.entry)+',\"stop_loss\":'+price(x.stop_loss)+',\"take_profit\":'+price(x.take_profit)+'}';
 return res.status(status).send(body);
};}
