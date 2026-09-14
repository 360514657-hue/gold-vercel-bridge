# Deployment handoff

Branch: codex/xauusd-signal-engine. Existing api/[...path].js is unchanged.

## Required user configuration

1. In the existing Vercel project's Settings > Environment Variables, set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for Preview only (optionally scope to codex/xauusd-signal-engine). Do not paste secrets into chat. Set MAX_CHASE_DISTANCE_USD=2.0 if overriding the default explicitly.
2. For local Redis acceptance, create ignored .env.local with the two Upstash variables. Run: node --env-file=.env.local scripts/validate-redis.js
3. Authorize Vercel CLI and link this existing project (vercel login, then vercel link), or supply an authorized CLI environment. The CLI is not currently installed/authorized here. Provide the existing Production URL. Do not create a replacement service.
4. Deploy the current branch to Preview, run online-check.js with VALIDATION_BASE_URL set to its URL, and compare the same checks with the unchanged production baseline. STOP after Preview checks. Production deployment/promotion is currently prohibited by the user; a future explicit instruction is required.

## Verification limits

Redis validation uses a dedicated random test key and deletes only that key. It checks writes, subsequent reads, independent clients, stale CAS rejection and a separate local process. This is NOT evidence of a Vercel cold start. Verify the same persisted revision across distinct Vercel invocations/instances before closing that item.

Health reads existing state without writing or running a signal. state_storage_ok means a persisted revision is readable; it is not a new write probe. Preview branches and Production use separate Redis keys. First invocation is bootstrap observation only.

online-check.js records statuses and response field names without dumping provider payloads. It does not inject upstream 500 errors. Missing-path 400 and exception 500 retain local handler coverage; actual Vercel routing and online failure behavior remain to verify. A successful HTTP 200 alone does not certify compatibility.

Scanner has the requested compact fields, but currently shares the full loader (six parallel upstream requests, up to eight seconds). Production latency is unverified; do not claim the low-latency requirement passed.

## Timing semantics

PREPARE uses proximity within USD 3 of an observed level; expected_entry_zone stays null until a structure supplies an entry basis. ARMED supplies a provisional trigger/extreme plan, which may fail risk limits and is never executable. A confirmed retest replaces it with the original risk plan. SIGNAL_READY is the public emission stage; internal ACTIVE tracks the already issued signal. An unactivated setup beyond MAX_CHASE_DISTANCE_USD in the trade direction is MISSED and cannot revive on a price return. Detectors still run only on new complete M5 bars; quote requests still recompute ancillary context/rating.

The key_zone_reached debug field is a compatibility name for a detected structural candidate at an observed liquidity level, not proof of a widened Zone or an exact tick touch. Quotes are indicative; no trade fills are recorded. Transition logs represent polling observations and can miss intermediate stages between requests. No always-running scheduler is deployed.

## Market acceptance

A/C: specified narrative expectations only; no verified timestamped live sequence supplied. Generic readiness gates have code tests, not live acceptance.
B: RULE_CONFLICT_RESOLVED_IN_CODE by first_retest_v2. A below-trigger rebound can confirm and use its actual confirming close as entry. Synthetic Case B: entry 4332, stop 4328.01, risk 3.99, TP1 4340, TP2 4347, RR1 > 2, rating A under all other valid gates. This is a constructed unit fixture, not validation of today's actual sequence, and does not force the entire requested entry band or any live rating.

No automatic trading, profitability evaluation or optimization performed.

## First Retest v2 (current definition)

Policy/state namespace: signal_rules_v2_first_retest. Old states are not migrated or overwritten; new namespace bootstraps in observation mode. Six model detectors are unchanged.

- Complete M5 bars only, after the recorded structure-break confirmation. A wick or one close across trigger does not by itself invalidate.
- Old-structure boundary is the pre-existing candidate reclaim level: reversal liquidity/reclaim anchor, or the broken range edge for continuation models. It is not an invented width around trigger. Two consecutive complete closes strictly on the old side constitute OLD_STRUCTURE_REACCEPTED. Equality is boundary, not acceptance. This is an explicit engineering convention, not an optimized parameter or statistical conclusion.
- If the first retest closes back beyond trigger, the existing confirmation path remains. Otherwise save its extreme as a pending pivot. Below-trigger BUY confirms only when a later complete bar has a strictly higher low and closes above that pivot bar's high, while closing at/above reclaim. SELL is symmetric (lower high, close below pivot low, at/below reclaim). A new equal/deeper pending extreme resets the pivot; no earlier confirmation is backfilled. Existing setup expiry still limits waiting.
- The pending first contact remains non-executable. Original setup extreme breach or data gap invalidates; after confirmation, breaking the retest HL/LH invalidates rather than moving the stop. Third retest is still forbidden.
- Below-trigger confirmation entry is the actual confirming close (a point reference, not a fabricated entry zone). Stop uses the entire observed pending/confirmation extreme plus the existing one-tick offset. Freshness, persistence, first-retest, risk <= 5 and RR >= 2 gates still apply.

## Manual setup (Preview only)

Upstash Console: open/create the Redis database intended for this project; Connect > REST supplies UPSTASH_REDIS_REST_URL and the regular read/write UPSTASH_REDIS_REST_TOKEN (not a read-only token). Copy directly to Vercel and the ignored local .env.local, never chat/Git.
Vercel: open the existing gold-vercel-bridge project; confirm Git repository and that codex/xauusd-signal-engine is NOT the Production Branch. Settings > Environment Variables: add the two values for Preview only; optionally bind to this development branch. Add MAX_CHASE_DISTANCE_USD=2.0 if desired. Changed variables require a new Preview deployment. Current edits are still local/uncommitted: an existing remote deployment will not include them. After committing/pushing this development branch, use its Preview deployment; do not merge to Production or click Promote to Production. Alternatively authorize CLI with vercel login and vercel link in this repository for a later Preview-only deployment.

References: https://upstash.com/docs/redis/features/restapi ; https://vercel.com/docs/environment-variables ; https://vercel.com/docs/git
