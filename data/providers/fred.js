// Independently sourced official daily series, NOT an intraday/PIT substitute.
export const fredSeries={US2Y:'DGS2',US10Y:'DGS10',REAL_YIELD:'DFII10'};
export async function loadFredDaily({fetcher=fetch,now=Date.now()}={}){
 const observations={};
 await Promise.all(Object.entries(fredSeries).map(async([name,id])=>{try{
 const start=new Date(now-14*86400000).toISOString().slice(0,10);
 const r=await fetcher('https://fred.stlouisfed.org/graph/fredgraph.csv?id='+id+'&cosd='+start,{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();
 const lines=(await r.text()).trim().split(/\r?\n/);if(lines.shift()!=='observation_date,'+id)throw Error();
 const rows=lines.map(line=>line.split(',')).filter(([date,value])=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&value!==''&&value!=='.'&&Number.isFinite(Number(value))&&date<=new Date(now).toISOString().slice(0,10));
 const last=rows.at(-1);observations[name]=last?{provider:'FRED',series_id:id,observation_date:last[0],value:Number(last[1]),retrieved_at:now,frequency:'DAILY',verified:false,execution_eligible:false,reason:'DAILY_RELEASE_TIME_AND_INTRADAY_FRESHNESS_NOT_VALIDATED'}:{reason:'MISSING'};
 }catch{observations[name]={provider:'FRED',series_id:id,verified:false,execution_eligible:false,reason:'SOURCE_UNAVAILABLE'};}}));
 return observations;
}
