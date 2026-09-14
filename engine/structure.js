export function swings(bars){
  const high=[],low=[];
  for(let i=1;i<bars.length-1;i++){
    const [a,b,c]=bars.slice(i-1,i+2);if(a.end!==b.at||b.end!==c.at)continue;
    if(b.high>a.high&&b.high>c.high)high.push({id:`H:${b.at}`,price:b.high,at:b.at,available_at:c.end});
    if(b.low<a.low&&b.low<c.low)low.push({id:`L:${b.at}`,price:b.low,at:b.at,available_at:c.end});
  }
  return {high,low};
}
export function shifted(candidate,bar){return candidate.direction==='BUY'?bar.close>candidate.trigger:bar.close<candidate.trigger;}
export function trend(bars){
  const {high,low}=swings(bars);
  if(high.length<2||low.length<2)return 'NO_TRADE';
  if(high.at(-1).price>high.at(-2).price&&low.at(-1).price>low.at(-2).price)return 'TREND_UP';
  if(high.at(-1).price<high.at(-2).price&&low.at(-1).price<low.at(-2).price)return 'TREND_DOWN';
  return 'NO_TRADE';
}
