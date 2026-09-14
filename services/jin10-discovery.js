import {discoverJin10} from '../data/providers/jin10-mcp.js';
export function discoveryHandler(kind,{discover=discoverJin10}={}){return async(req,res)=>{
 res.setHeader('Cache-Control','no-store');if(req.method!=='GET')return res.status(405).json({error:'Method Not Allowed'});
 try{const x=await discover({quotes:kind==='macro'});return res.status(200).json(kind==='macro'?x.quotes:x);}
 catch(error){const code=['JIN10_MCP_AUTH_REQUIRED','RESOURCE_FORMAT_REQUIRES_REVIEW'].includes(error?.message)?error.message:'JIN10_RESOURCE_UNAVAILABLE';
 if(kind==='macro')return res.status(503).json({dxy:null,us2y:null,us10y:null});return res.status(503).json({resource_read:false,resource_uri:'quote://codes',error:code});}
};}
