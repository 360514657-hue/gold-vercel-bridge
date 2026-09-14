// Engineering parameters only; no fitted or profitability claims.
export const macroMarketPolicy=Object.freeze({version:'te_multihorizon_v1',weights:{DXY:40,US2Y:35,US10Y:25},threshold:40,maxAgeMs:120000,referenceToleranceMs:90000,noise:{DXY:{m5:.01,m15:.02},US2Y:{m5:.5,m15:1},US10Y:{m5:.5,m15:1}},strongTimingWeight:40});
