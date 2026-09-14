# Preview watcher

POST /api/watch/xauusd invokes the existing six-source Jin10 loader and signal engine. GET /api/events/xauusd?limit=50 reads newest-first transitions (limit 1–200, default 50). No order APIs exist. Existing quote/bars/calendar/flash proxy is unchanged.

## Authentication and Preview setup

Use official @upstash/qstash 2.11.3 Receiver. Set QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY in Preview. Set WATCH_DESTINATION_URL to the exact HTTPS Preview URL plus /api/watch/xauusd, with no query. Both signatures and SHA-256 raw-body hash are verified, with issuer, expiry and exact destination checks. Anonymous requests receive 401; missing configuration fails closed with 503. No request-provided host controls signature verification. Dev signing keys are disabled.

QSTASH_TOKEN is required by schedule management, not accepted as watcher authentication. Configure it in the local ignored .env.local for setup; never share keys in chat or commit them. QSTASH_URL may select the regional endpoint from the QStash console.

If Preview Protection is enabled, retain it. In Vercel project Settings > Deployment Protection > Protection Bypass for Automation create a secret. Place it in local VERCEL_AUTOMATION_BYPASS_SECRET. The setup script sends x-vercel-protection-bypass as a forwarded destination header, never a URL query. Bypass does not replace QStash signature verification. Treat the bypass as a project credential. Do not disable all deployment protection for testing.

Set WATCH_TARGET_ENV=preview and WATCH_DESTINATION_URL locally. Verify this is the development branch Preview, not a production domain. After its new deployment and Preview environment variables are ready, run:

    node --env-file=.env.local scripts/setup-qstash.js

It creates/updates only gold-xauusd-preview-watcher, POST body {}, cron * * * * * (UTC). retries=0 avoids delayed automatic retry storms; the following scheduled minute retries normal processing. Same-stage/same-signal deduplication and atomic CAS also handle concurrent or duplicate deliveries. There is no schedule creation during build/import. If using an immutable Preview URL, update destination and the schedule when deploying a replacement; a verified development-branch alias avoids this churn.

Inspect QStash delivery logs for consecutive successful minute deliveries. Use events/health for state; quiet minutes intentionally produce no transition event, so events alone do not prove minute delivery. Initial schedule loading may take up to 60 seconds. Check unsigned POST is rejected and signed delivery succeeds before claiming operational validation.

## State and durability

Each successfully committed engine state includes the latest 200 transition events in the same Redis CAS transaction. Subsequent instances read the same state. Dedup key is the last stage plus signal_id, so returning to a prior stage later is a real transition. Existing 100-event history is retained and grows to the new cap; no historical events are fabricated. latency_ms measures data load + evaluation + state read before commit, not total QStash/network latency or final Redis write.

Public ACTIVE is normalized to SIGNAL_READY for an already emitted setup; this is not a fresh order. A quote beyond the entry by more than MAX_CHASE_DISTANCE_USD (default 2.0) becomes MISSED unless an existing invalidation/TP milestone already takes precedence. TP1/TP2 are sampled price observations, never confirmed trade fills.

Stale/out-of-order quotes preserve the prior engine watermark/candidate and append DEGRADED / NO_TRADE once. Redis failures return 503 / DEGRADED and write a sanitized platform log; persisting an event to unavailable Redis is impossible. Do not claim those outage events were archived. On recovery the next call resumes the durable state. State retention remains the existing seven-day TTL renewed on writes. Schedule gaps may therefore trigger observation-only bootstrap after expiry.

Transitions are observed per invocation; minute polling cannot reconstruct every intraminute stage or missing quote. Detectors remain complete-bar based and no model is rewritten. GET signal/scanner/debug still use the same shared service and can advance it; CAS coordinates these with watcher calls.

## Current verification

59 local tests passed, including Redis REST/CAS simulation and a new independent adapter reading persisted state. This is simulated cold-start evidence, not a new live Vercel cold-start test. User reports existing live Redis passed. QStash schedule and live delivery are NOT_CONFIGURED in this development environment (no credentials/destination available). Latest live state UNKNOWN until an authorized Preview read is available.

Sources: https://upstash.com/docs/qstash/features/schedules ; https://github.com/upstash/qstash-js ; https://upstash.com/docs/workflow/troubleshooting/vercel
