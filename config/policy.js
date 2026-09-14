// Engineering definitions, not fitted parameters or demonstrated trading edge.
export const policy = Object.freeze({version:'signal_rules_v2_first_retest', quoteMaxAgeMs:90000,
  barMaxAgeMs:600000, maxRisk:5, minRR:2, topRR:2.5, tick:0.01,
  balanceBars:4, balanceDrift:0.35, balanceBody:0.45, sweepExpiryBars:6,
  setupExpiryBars:12, vAcceleration:1.5, vDistanceTR:2, signalTTL:300000,
  macroTTL:3600000, eventWindow:900000, sessionCalendar:'UTC_8H_OBSERVED_V1'});
export const ms = {M5:300000,M15:900000};
export const round = x => Math.round(x*100)/100;
