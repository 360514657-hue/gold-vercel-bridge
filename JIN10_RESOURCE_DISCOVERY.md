# Jin10 resource discovery investigation

Branch: codex/xauusd-signal-engine. No main/Production/Worker deployment changed. No third-party macro feed was queried or substituted in this task. Existing FRED code was neither enabled nor used for discovery.

## Repository inventory (before this change)

Checked git ls-tree -r HEAD, current files with rg, available local branch history with git log --all and worker/wrangler/cloudflare path filters. The only remote repository found for this owner is gold-vercel-bridge. Existing files:

- api/[...path].js: generic GET forwarder to https://gold.360514657.workers.dev. It is not a Worker entrypoint and contains no MCP session or RPC implementation.
- data/jin10.js: quote/bars/calendar/flash HTTP consumer of that Worker.
- services/health.js and smoke scripts: HTTP consumers only.

Missing implementation artifacts (names are examples, not asserted original filenames):

- Cloudflare Worker entry source: no worker.js, worker.ts, src/worker.*, or equivalent fetch-handler module found.
- Cloudflare deployment configuration: no wrangler.toml, wrangler.json, or wrangler.jsonc.
- Worker's existing Jin10 MCP connection/session/auth binding implementation.
- Worker's tools/call proxy and resources/read/resources/list handlers.
- Worker binding/deployment manifest needed to safely change its resource exposure.

The new data/providers/jin10-mcp.js is a new standard client adapter, not recovered Worker source. Without the original source, the deployed Worker's exact limitations cannot be proven from this repository; /codes timeout is not proof that Jin10 lacks the instruments.

## Transport finding

Official Jin10 docs publish https://mcp.jin10.com/mcp, Authorization: Bearer (existing credential), tools get_quote/get_kline. Standard Streamable HTTP MCP flow is initialize -> notifications/initialized -> resources/read with params {uri:quote://codes}. tools/call is a separate RPC used only after discovery to request get_quote with the discovered code. SDK manages JSON/SSE, protocol negotiation, and session headers. It is incorrect to invoke quote://codes as a tool name.

Official SDK @modelcontextprotocol/sdk 1.30.0 is pinned. No secret values are returned or logged. The adapter can use an already configured server-side JIN10_MCP_TOKEN; no key is requested, generated or replaced by this code. It rejects missing auth before attempting direct calls. Do not expose an arbitrary URI, arbitrary tool name or client-supplied authorization proxy.

## Actual observations

- Existing bridge /codes and /tools: bounded requests timed out in this run.
- Direct official MCP initialize without credentials: HTTP 401, text/plain; authentication required. No resource contents were obtained.
- Local MCP credential presence check: absent (value never printed). No further credential request is needed; this report records the constraint.
- App references supplied by user at about 2026-09-14 20:42 Beijing: DXY ~99.641, US2YT ~4.6450%, US10YT ~4.9850%. These are user reference observations, not adapter quote responses.

| App display symbol | Chinese lookup | MCP internal code | Real quote/timestamp | M1/M5/M15 |
|---|---|---|---|---|
| DXY | 美元指数 | UNKNOWN | NOT_VERIFIED | NOT_TESTED |
| US2YT | 美国2年国债收益率 (also accepts 年期 wording) | UNKNOWN | NOT_VERIFIED | NOT_TESTED |
| US10YT | 美国10年国债收益率 (also accepts 年期 wording) | UNKNOWN | NOT_VERIFIED | NOT_TESTED |

## Added read-only bridge interfaces

GET /api/debug/jin10-codes reads only quote://codes, returns a content hash and Chinese-name mappings. Supported JSON record shapes use code/name, nested containers allowed. Unrecognized text/Markdown format requires review; it is never parsed heuristically into guessed codes. Multiple matches are AMBIGUOUS. App symbols are display metadata only.

GET /api/debug/jin10-macro returns exactly dxy/us2y/us10y. Each contains only an identity-, magnitude- and timestamp-verified quote, otherwise null. It verifies the get_quote input schema first and blocks unfamiliar required arguments. DXY must be in a broad 50–150 index sanity range; yields in 0–20 percent units; timestamps must not be future and must be <=120 seconds old. These bounds are sanity checks, not identification proof or fixed expected prices.

scripts/discover-jin10.js first reads resources and validates all three quotes. Only then does it probe the existing /kline M1 and /bars M5/M15 routes with resource-derived codes. It checks returned identity, timestamps, cadence, OHLC and complete constituent counts. It distinguishes failed/incomplete samples from proof of unsupported instruments. No guessed code is issued. No native get_kline argument or timeframe enum is invented.

100/100 tests pass; fixtures use TEST_D/TEST_2/TEST_10 as visibly synthetic examples only. Actual resource read, three real quotes and bar support remain unverified. Macro Engine V2 is NOT connected to these unverified mappings. Existing watcher, Redis/events and automatic-order-disabled behavior are preserved.

Sources: https://mcp.jin10.com/app/doc.html ; https://modelcontextprotocol.io/specification/2025-03-26/server/resources
