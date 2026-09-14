# Final Build V1 — Preview only

Frozen providers: Jin10 XAUUSD/M5/M15/calendar/news; iTick Free Trial DXY, token header, code DXY discovered and verified on 2026-09-14. US2Y/US10Y unavailable and optional (data/providers/optional-yields.js); no TE/Twelve/FRED runtime calls. Archived adapters/tests remain for provenance only. News text appears as context, never supplies machine direction. No LLM in decisions, no broker/order connection. Prior uncommitted paper-study modules were removed; no backtest or profitability statistics were run.

## Rules and audit

config/macro-policy.js: DXY completed-M1 close change over exact 5/15 minutes, no interpolation or incomplete bar. 15m >=+0.10% with 5m >=-0.03% is bearish gold; 15m <=-0.10% with 5m <=+0.03% is bullish gold; otherwise neutral. Missing/stale/future DXY is neutral and blocks new execution. Fresh quote <=90s and last completed minute <=60s. Event window is 15m before/after important US data/FOMC/Powell; malformed/absent calendar fails closed. These are engineering conventions, not fitted parameters.

Existing six numerical detectors and First Retest v2 stay in place. Reversal sweeps require strict low<level and close>level (SELL symmetric), confirmed ex-ante swing/range, then confirmed structural break and first retest. Continuations retain explicit range-break/acceptance semantics: audit SWEEP=false rather than pretending a continuation swept liquidity. Debug structure_steps exposes boolean/time/price/reference for every stage. Jin10 indicative OHLC proves an observed quote excursion, not an exchange trade/fill. Unknown historical evidence fields stay null.

Macro failure requires opposing macro plus confirmed liquidity sweep, reclaim, shift and first retest. Neutral permits complete reversals with every risk/data gate. New entry is the fixed confirmed-retest close; SL is retest extreme plus/minus clamped M5 ATR5 buffer. No ATR fallback is enabled: missing bars means NONE. Both M5/M15 quality must be GOOD. Risk <=5; nearest observed target must clear 2R before any second target is eligible. STRONG requires aligned macro, aligned trend, first retest and fresh complete data. Max chase 2 USD. Machine contract remains exactly five fields with two-decimal numeric formatting.

## ACTIVE is a signal, not a fill

First valid contract records immutable id/side/entry/initial SL/TP/activation time, with persistent activated_signal_ids. No automatic reversal while active. Management evaluates previously committed SL/TP against fresh observed quotes before updates. A stop/target observation closes the signal, never claims actual fills.

New favorable pivot uses a strict three-bar swing, all bars complete, pivot occurs after activation, new confirmation time, BUY higher than prior low / SELL lower than prior high. Current ATR buffer supplies proposed stop; only more protective stop on the safe side of current quote can replace it. At >=1 initial R, with that same new pivot confirmation, protect at least break-even. Without pivot, 1R alone changes nothing. ENTRY stays fixed. TP never extends after activation: loss of aligned macro or a new opposing shift may select the nearest already-known level ahead of current quote and closer than current TP. Data/event failures suppress outward contract to NONE, preserving ACTIVE management state until observable closure. No new opposite signal that poll.

## Alert read contract

GET /api/alerts/xauusd/latest is the sole ChatGPT message source. It returns exactly macro, side, entry, stop_loss, take_profit, human_message, updated_at (ISO), signal_id. Message rendering is a fixed Chinese template with two decimal prices. GPT cannot decide or modify direction, prices, score or structure.

The watcher persists latest_alert, latest_alert_contract_hash and alert_updated_at in the same Redis CAS as execution. Hash covers material side/entry/SL/TP fields: macro-only changes without an effect on permission do not replace the alert, message or update time. A permission change that cancels/permits a trade changes side and generates one new alert. ACTIVE entry is immutable. Initial NONE is stored once; identical snapshots never refresh alert time. Old nested alerts migrate once and retired notification state is removed without sending anything.

Stale/missing/future watcher time (>120s), malformed state or store failure returns HTTP 503 and the same eight-field shape with NONE/null prices. The last known alert timestamp is preserved when available; before any alert it is the Unix epoch, not an invented live update. Reading does not write Redis. Only fresh responses are usable machine messages.

There is no email provider, dispatch, configuration, health check or outbox. External Vercel does not directly push events into an existing ChatGPT conversation. ChatGPT reads /api/alerts/xauusd/latest; no proactive ChatGPT push is claimed.

## Deployment and verification

Existing development-branch Git push deploys Preview only. Existing QStash minute schedule, signatures and bypass remain unchanged. No main merge, Production promotion or broker orders. Health checks jin10_ok, xau_quote_fresh, itick_ok, dxy_fresh, redis_ok, state_storage_ok, watcher_recent, latest_alert_time. No performance backtest is run.
