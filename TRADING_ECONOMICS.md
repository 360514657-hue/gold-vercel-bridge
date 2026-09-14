# Trading Economics Preview adapter

Scope: DXY, US 2Y and US 10Y only. Jin10 remains XAUUSD/calendar/news. No brokerage or order API exists. Macro parameters are engineering conventions, not optimized or profitable-strategy claims.

## Current acceptance status

Local TRADING_ECONOMICS_API_KEY is absent. Real symbols, quotes, timestamps and intraday entitlement remain NOT_VALIDATED. No website/example symbol has been installed as a live mapping. Unit fixtures are synthetic. Missing credentials mean no TE HTTP request and execution NEUTRAL/NONE. Runtime requires all three instruments to validate in the current snapshot before allowing macro direction. PARTIAL diagnostic components never permit execution.

## Official discovery and normalization

Search /markets/search/dollar%20index and /markets/search/united%20states; select exactly one matching name/country/type per instrument, using the returned Symbol. Ambiguity fails closed. Verify /markets/symbology/symbol/{returned-symbol}, then /markets/symbol/{returned-symbol} and /markets/intraday/{returned-symbol}?agr=1m. Never guess or fall back to another source. Authorization header contains the server env credential; credentials never appear in query strings or errors. Requests reject redirects and have 8-second bounds. No automatic retries.

Quote Date is UTC under the official API contract; it is used instead of LastUpdate. Live frequency, identity, units and age <=120 seconds are required. Delayed subscriptions fail eligibility. Require contiguous positive OHLC minute observations; duplicates/gaps fail, no interpolation. For conservative completed-bar handling, intraday Date is treated as open and close availability is Date+1 minute. This boundary convention still requires real-provider acceptance; no real-history success is claimed. Future bars are excluded. Reference observations must end at/before quote time minus 5/15 minutes, with at most 90 seconds tolerance. Snapshots include nulls/fresh=false when unavailable.

Discovery and symbology run per snapshot (11 requests total), without an unverified long-lived symbol cache. Subscription rate limits, real latency and bar timestamp convention remain acceptance items before relying on the minute watcher. Quote timestamp is bounded by the snapshot as-of time, preventing later responses from leaking into an earlier decision.

## Deterministic direction

config/macro-market.js is the single parameter source. DXY percent change=(current/reference-1)*100. Yield bp change=(current-reference)*100 when yields are quoted as percentage points. Weights 40/35/25. Deadbands: DXY 5m .01%, 15m .02%; yields 5m .5bp, 15m 1bp. A nonzero 15m move defines direction; opposing 5m movement vetoes that component, flat 5m is allowed. Rising instruments contribute negative gold weight; falling instruments positive. Score >=40 BULLISH, <=-40 BEARISH, else NEUTRAL. Missing any critical component forces NEUTRAL and NONE regardless of partial score.

STRONG also requires DXY and both bonds aligned on 15m (strict majority of two bonds), no opposing DXY 5m, and aligned 5m weight >=40. Perfect minute synchronization is not required. Existing confirmed reversal/macro-failure plus full structure and First Retest exception remains; structure supplies every entry, stop and target. Existing max-chase 2 USD, risk and RR gates are unchanged. No absolute yield level alone creates direction.

GET /api/debug/macro-market returns only dxy/us2y/us10y normalized current snapshots. GET /api/debug/xauusd adds safe provider discovery/validation metadata and macro components. GET /api/execution/xauusd retains exactly five fields. All normal Vercel Preview protection remains in force.

## Real validation command

Set the existing entitled credential only in ignored .env.local / Preview environment, then run:

    node --env-file-if-exists=.env.local scripts/verify-trading-economics.js

Exit 2 means not verified. Output contains sanitized symbols, current snapshot and validation flags, never the key. Do not promote a successful synthetic test to live acceptance. Add the credential to Vercel Preview only, redeploy Preview via the development branch, and check debug + execution using existing protection bypass privately. No Production promotion, no QStash key changes or schedule changes.

Official references:
- https://docs.tradingeconomics.com/get_started/
- https://docs.tradingeconomics.com/markets/search/
- https://docs.tradingeconomics.com/markets/symbology/
- https://docs.tradingeconomics.com/markets/symbols/
- https://docs.tradingeconomics.com/markets/intraday/
