# Machine Execution Contract V1

Authoritative execution output: GET /api/execution/xauusd. Exactly macro, side, entry, stop_loss, take_profit; numeric prices serialize with two decimals. NONE always has three null prices. Failures return the same five-field NEUTRAL/NONE shape with HTTP 503; unsupported methods use 405. No order execution exists. Legacy signal/scanner/debug outputs remain diagnostic and must not be treated as this stricter execution contract.

## Source discovery and current limitation

Read-only bridge root discovery succeeded on 2026-09-14 and reported version 3.0.0 plus /codes and /tools. Subsequent /codes (including retry through configured system proxy), /tools, /openapi.json and quote requests timed out. No DXY/US2Y/US10Y symbol was guessed. This does NOT establish that the bridge lacks those instruments; support is NOT_VERIFIED.

Independent official FRED adapter maps US2Y=DGS2, US10Y=DGS10, REAL_YIELD=DFII10. CSV probes also timed out. These daily series are documented official sources but are NOT verified intraday feeds or point-in-time release timestamps. The adapter is optional diagnostic context only (FRED_CONTEXT_ENABLED=true); its values are explicitly execution_eligible=false and verified=false. No successful new live macro data source is claimed. It is off by default and may never elevate daily observations into fresh intraday signals. Broad trade-weighted dollar indices are not substituted for DXY.

Still DATA_SOURCE_REQUIRED: verified intraday DXY/US2Y/US10Y changes with comparison timestamps, real yield of suitable timeliness, Fed expectations repricing, CPI/PCE/NFP/FOMC actual vs historical consensus with machine-readable rate impact, and numeric verified risk-event factors. Calendar/news text does not contribute a directional score. Existing calendar handling remains a conservative event-window blocker, not a release surprise inference. The currently wired real input therefore yields macro quality MISSING and execution NONE. This is an intentional gate, not completed live macro integration.

## Macro engine V2

config/execution.js centralizes engineering parameters: DXY 30, US2Y 25, US10Y 20, real yield 5, Fed repricing 10, verified economic rate-pressure surprise 8, verified risk-event rate-pressure factor 2. Positive observed numeric rate pressure contributes negative gold weight; negative pressure contributes positive weight. Comparison requires verified provider, execution eligibility, finite value/reference, reference_at < observation at <= available_at <= decision time, and observation/release age <= 15 minutes. Adapters, not HTTP clients, own this evidence. Test fixtures marked TEST_ONLY are never loaded by production code.

Critical DXY/US2Y/US10Y must all validate. If any fails, bias is NEUTRAL and acceptable=false irrespective of the partial numerical score. All components present => GOOD; some => PARTIAL; none => MISSING. PARTIAL is acceptable only with all critical components present. Thresholds +40/-40 select BULLISH/BEARISH. No thresholds or weights were optimized or claimed profitable.

## Permission and exact risk

Aligned macro permits complete structure. Opposing macro requires observed sweep, reclaim, later shift, confirmed first retest and known liquidity anchor (Macro Failure). Failure lifts direction filtering only. NEUTRAL requires the full sweep/reclaim/shift/first-retest path; continuation acceptance alone is insufficient. Second/third retests cannot execute. Source quality, known calendar/no high-impact event, fresh quote and confirmation, durable state, live unexpired/non-historical setup, non-missed and non-withdrawn candidate all gate execution.

Entry is confirmed first-retest bar close rounded to cents, independent of current quote. ATR is simple mean of five TRs from six contiguous complete M5 bars ending no later than retest confirmation. Buffer=clamp(ATR*0.15,0.05,0.50). BUY stop is retest low minus buffer, rounded downward; SELL stop retest high plus buffer, rounded upward. Insufficient data => NONE. Risk must be >0 and <=5; stop is never moved closer to pass.

Targets are actual recorded levels available by retest confirmation, sorted by distance in trade direction. Nearest target must pass RR>=2 regardless of second target. STRONG requires macro alignment, same-direction trend, first retest and acceptable data; only then can second real target with RR>=2 be selected. Otherwise choose nearest. A nearer obstruction under 2R is never skipped. Current quote must stay within USD 2 of exact entry, on the valid side of SL and before nearest TP. Entry does not drift with quote.

All diagnostic values/decision booleans are under debug.execution. Repeated identical active contract is an observation of the same signal, not another order. Once withdrawn, the same candidate id cannot be reissued. Macro-only changes with the same side/prices do not append execution events. Side or price changes append execution_events (latest 200) atomically with existing state/events via CAS. Watcher computes this every authenticated invocation; existing QStash schedule/credentials are untouched.

## Verification

92/92 tests passed including direction symmetry, objective Macro Failure, stop/target constraints, missing/invalid macro, incomplete ATR, exact entry invariance, STRONG nearest-target gate, five-field JSON, safe failures, and execution-event deduplication. Existing 61 tests pass. Live macro integration and authenticated online contract acceptance remain unverified. Automatic orders remain disabled; no profitability evaluation or parameter optimization performed.
