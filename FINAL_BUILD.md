# Final Build V1 — Preview only

Frozen providers: Jin10 XAUUSD/M5/M15/calendar/news; iTick Free Trial DXY, token header, code DXY discovered and verified on 2026-09-14. US2Y/US10Y unavailable and optional (data/providers/optional-yields.js); no TE/Twelve/FRED runtime calls. Archived adapters/tests remain for provenance only. News text appears as context, never supplies machine direction. No LLM in decisions, no broker/order connection. Prior uncommitted paper-study modules were removed; no backtest or profitability statistics were run.

## Rules and audit

config/macro-policy.js: DXY completed-M1 close change over exact 5/15 minutes, no interpolation or incomplete bar. 15m >=+0.10% with 5m >=-0.03% is bearish gold; 15m <=-0.10% with 5m <=+0.03% is bullish gold; otherwise neutral. Missing/stale/future DXY is neutral and blocks new execution. Fresh quote <=90s and last completed minute <=60s. Event window is 15m before/after important US data/FOMC/Powell; malformed/absent calendar fails closed. These are engineering conventions, not fitted parameters.

Existing six numerical detectors and First Retest v2 stay in place. Reversal sweeps require strict low<level and close>level (SELL symmetric), confirmed ex-ante swing/range, then confirmed structural break and first retest. Continuations retain explicit range-break/acceptance semantics: audit SWEEP=false rather than pretending a continuation swept liquidity. Debug structure_steps exposes boolean/time/price/reference for every stage. Jin10 indicative OHLC proves an observed quote excursion, not an exchange trade/fill. Unknown historical evidence fields stay null.

Macro failure requires opposing macro plus confirmed liquidity sweep, reclaim, shift and first retest. Neutral permits complete reversals with every risk/data gate. New entry is the fixed confirmed-retest close; SL is retest extreme plus/minus clamped M5 ATR5 buffer. No ATR fallback is enabled: missing bars means NONE. Both M5/M15 quality must be GOOD. Risk <=5; nearest observed target must clear 2R before any second target is eligible. STRONG requires aligned macro, aligned trend, first retest and fresh complete data. Max chase 2 USD. Machine contract remains exactly five fields with two-decimal numeric formatting.

## ACTIVE is a signal, not a fill

First valid contract records immutable id/side/entry/initial SL/TP/activation time, with persistent activated_signal_ids. No automatic reversal while active. Management evaluates previously committed SL/TP against fresh observed quotes before updates. A stop/target observation closes the signal, never claims actual fills.

New favorable pivot uses a strict three-bar swing, all bars complete, pivot occurs after activation, new confirmation time, BUY higher than prior low / SELL lower than prior high. Current ATR buffer supplies proposed stop; only more protective stop on the safe side of current quote can replace it. At >=1 initial R, with that same new pivot confirmation, protect at least break-even. Without pivot, 1R alone changes nothing. ENTRY stays fixed. TP never extends after activation: loss of aligned macro or a new opposing shift may select the nearest already-known level ahead of current quote and closer than current TP. Data/event failures suppress outward contract to NONE, preserving ACTIVE management state until observable closure. No new opposite signal that poll.

## Alerts and email

GET /api/alerts/xauusd/latest reads the persisted exact five-field contract and deterministic Chinese template. Stale watcher >120s returns NONE, not an old actionable message. A macro-only change without price/side change updates visible context but does not send a duplicate. New side, cancellation, SL or TP changes create one CAS outbox record; last_alert_contract_hash is persisted. Outbox is committed with signal state before sending. Resend uses the same alert id as Idempotency-Key, a CAS lease, max three attempts and no automated retry beyond 23h (provider key retention is 24h). Email failures do not fail the watcher. Accepted API send is SENT, not proof of inbox delivery.

Server-only Preview env: ALERT_EMAIL_ENABLED=true, ALERT_EMAIL_TO, ALERT_EMAIL_FROM (verified sending domain), RESEND_API_KEY. Missing setup => NOT_CONFIGURED. Body contains only the five-line signal or two-line no-trade template. No ChatGPT proactive push is claimed; ChatGPT reads the alert endpoint. No email credentials or addresses are exposed in health/debug.

## Deployment and verification

Use existing codex/xauusd-signal-engine Git push Preview flow and existing QStash schedule/signatures/protection bypass. Set ITICK_API_KEY in Preview; free host is fixed regardless of external env. Do not merge main, promote Production, change QStash keys or create duplicate schedules. Existing four proxy interfaces are unchanged.

Verify health, execution, debug, latest alert and events. Confirm three distinct last_watch timestamps with increasing versions; ordinary GET-induced revisions do not prove QStash delivery. Configured email can be ready without sending a fabricated signal. Real market may remain NONE indefinitely when any gate fails; no forced signal for demonstration.
