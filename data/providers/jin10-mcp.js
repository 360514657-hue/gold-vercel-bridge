import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {createHash} from 'node:crypto';
import {timestamp} from '../jin10.js';
export const MCP_URL='https://mcp.jin10.com/mcp';
export const CODE_RESOURCE='quote://codes';
const names={dxy:{app_symbol:'DXY',match:/^美元指数$/},us2y:{app_symbol:'US2YT',match:/^美国2年(?:期)?国债收益率$/},us10y:{app_symbol:'US10YT',match:/^美国10年(?:期)?国债收益率$/}};
const normalize=x=>String(x??'').normalize('NFKC').replace(/\s/g,'');
export function parseCodes(resource){
 const text=(resource.contents??[]).filter(x=>x.uri===CODE_RESOURCE&&typeof x.text==='string').map(x=>x.text).join('\n');
 const hash=createHash('sha256').update(text).digest('hex');
 let data;try{data=JSON.parse(text);}catch{throw Error('RESOURCE_FORMAT_REQUIRES_REVIEW');}
 const rows=[];function walk(x){if(Array.isArray(x)){x.forEach(walk);return;}if(x&&typeof x==='object'){if(typeof x.code==='string'&&typeof x.name==='string')rows.push({code:x.code,name:x.name});else Object.values(x).forEach(walk);}}walk(data);
 if(!rows.length)throw Error('RESOURCE_FORMAT_REQUIRES_REVIEW');
 const mapping={};for(const [key,spec] of Object.entries(names)){const hits=[...new Map(rows.filter(x=>spec.match.test(normalize(x.name))).map(x=>[x.code,x])).values()];mapping[key]={app_display_symbol:spec.app_symbol,internal_code:hits.length===1?hits[0].code:null,chinese_name:hits.length===1?hits[0].name:null,status:hits.length===1?'FOUND':hits.length?'AMBIGUOUS':'NOT_FOUND'};}
 return {resource_uri:CODE_RESOURCE,resource_hash:hash,mapping};
}
function unwrap(result){if(result?.isError)throw Error('MCP_TOOL_ERROR');if(result?.structuredContent)return result.structuredContent;const texts=(result?.content??[]).filter(c=>c.type==='text').map(c=>c.text);if(texts.length!==1)throw Error('MCP_QUOTE_FORMAT_UNVERIFIED');try{return JSON.parse(texts[0]);}catch{throw Error('MCP_QUOTE_FORMAT_UNVERIFIED');}}
export function validateQuote(raw,entry,key,now){
 const d=raw?.data,at=timestamp(d?.time),value=Number(d?.close),scale=key==='dxy'?value>50&&value<150:value>0&&value<20;
 const valid=raw?.status===200&&d?.code===entry.internal_code&&names[key].match.test(normalize(d?.name))&&d?.close!==''&&d?.close!==null&&Number.isFinite(value)&&scale&&Number.isFinite(at)&&at<=now&&now-at<=120000;
 return valid?{code:d.code,name:d.name,value,timestamp:new Date(at).toISOString(),age_seconds:(now-at)/1000,unit:key==='dxy'?'INDEX_POINTS':'PERCENT',verified:true}:null;
}
export async function connectJin10({token=process.env.JIN10_MCP_TOKEN,fetcher=fetch}={}){
 if(!token)throw Error('JIN10_MCP_AUTH_REQUIRED');
 const client=new Client({name:'gold-resource-discovery',version:'1.0.0'},{capabilities:{}});
 const transport=new StreamableHTTPClientTransport(new URL(MCP_URL),{requestInit:{headers:{Authorization:'Bearer '+token}},fetch:async(url,options)=>fetcher(url,{...options,signal:AbortSignal.any([...(options?.signal?[options.signal]:[]),AbortSignal.timeout(12000)])})});
 try{await client.connect(transport);return client;}catch{await transport.close().catch(()=>{});throw Error('JIN10_MCP_CONNECTION_FAILED');}
}
export async function discoverJin10({connect=connectJin10,now=Date.now(),quotes=false}={}){
 const client=await connect();try{
 // SDK handles initialize, initialized notification, protocol/session headers and JSON/SSE.
 // This sends resources/read, never tools/call with quote://codes as a tool name.
 const resource=await client.readResource({uri:CODE_RESOURCE},{timeout:12000});
 const result=parseCodes(resource);result.resource_read=true;result.retrieved_at=new Date(now).toISOString();
 if(quotes){const listed=await client.listTools({}, {timeout:12000});const tool=listed.tools.find(t=>t.name==='get_quote');
 const allowed=tool?.inputSchema?.properties?.code&&(tool.inputSchema.required??[]).every(k=>k==='code');
 result.quotes={dxy:null,us2y:null,us10y:null};result.quote_status={};
 for(const [key,entry] of Object.entries(result.mapping)){
 if(!entry.internal_code){result.quote_status[key]=entry.status;continue;}
 if(!allowed){result.quote_status[key]='QUOTE_TOOL_SCHEMA_REQUIRES_REVIEW';continue;}
 try{const raw=unwrap(await client.callTool({name:'get_quote',arguments:{code:entry.internal_code}},undefined,{timeout:12000}));result.quotes[key]=validateQuote(raw,entry,key,Date.now());result.quote_status[key]=result.quotes[key]?'VERIFIED':'QUOTE_IDENTITY_SCALE_OR_FRESHNESS_FAILED';}catch{result.quote_status[key]='QUOTE_REQUEST_FAILED';}
 }
 result.all_quotes_verified=Object.values(result.quotes).every(Boolean);
 }
 return result;
 }finally{await client.close().catch(()=>{});}
}
