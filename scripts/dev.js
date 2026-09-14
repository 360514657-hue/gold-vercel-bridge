import watch from '../api/watch/xauusd.js';
import events from '../api/events/xauusd.js';
import health from '../services/health.js';
import {createServer} from 'node:http';
import proxy from '../api/[...path].js';
import {endpoint} from '../services/http.js';
const routes=Object.fromEntries(['signal','scanner','debug'].map(v=>[`/api/${v}/xauusd`,endpoint(v)]));
routes['/api/health/signal']=health;
routes['/api/watch/xauusd']=watch;routes['/api/events/xauusd']=events;
createServer(async(req,res)=>{
  res.status=n=>(res.statusCode=n,res);res.json=x=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(x));};res.send=x=>res.end(x);
  await (routes[new URL(req.url,'http://localhost').pathname]??proxy)(req,res);
}).listen(Number(process.env.PORT??3000),'127.0.0.1',()=>console.log('Local bridge: http://127.0.0.1:'+(process.env.PORT??3000)));
