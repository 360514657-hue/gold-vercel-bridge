# 实现与验证记录

日期：2026-09-14。基础提交：`6b5057d7ffbeacd02b6ddc18f707ea18608d0216`。
开发分支：`codex/xauusd-signal-engine`。本地实现，尚未推送或部署。

## 已通过

- 全部32项 Node 测试通过。最终命令：`node --test --test-isolation=none`；正常隔离的 `node --test` 也在此前31项版本通过，最后新增的是Entry区间整体风险约束测试。
- 六个模型各自模拟序列、假回收、倒V、真实/失败突破、首次至第三次回踩、区间中部、结构止损、RR、时序和缺口。
- 完整 V1 请求流程、冷启动旧回踩不复用、旧quote/修订bar防误发、相同市场快照跨API复用。
- 四个既有接口的正文/状态/query转发、重复query、OPTIONS、405、400和500行为。
- `git diff --exit-code HEAD -- 'api/[...path].js'` 通过：既有代理源文件未修改。
- `git diff --check` 无空白错误。
- Redis适配器命令测试及CAS并发旧版本拒绝测试通过；没有使用真实Redis。

## 只读真实数据抽查

通过 Windows HTTPS 传输取得既有桥的6个数据响应并交给同一Node规范化代码。
当次快照 quote_fresh=true，完整M5=10，完整M15=12，两周期均PARTIAL，标记INCOMPLETE_M1和STALE_BARS。
宏观接口可用，6个请求无失败。仅用于schema/降级验证；没有归档原始行情、没有评估盈利。

本机Node直接fetch同一Worker返回 `UND_ERR_CONNECT_TIMEOUT`。8秒超时路径正确降级为NO_TRADE，没有未捕获异常。
Windows传输可用不证明生产Node链路可用，Vercel部署环境仍需单独连通验收。

## 未完成的外部验收

1. 配置真实 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`，验证跨实例重启、CAS和存储可用性。
2. Vercel构建、路由优先级及四个旧路径的线上回归。当前仅验证源码保留和handler行为，没有宣称线上已部署。
3. 信号定义的实际市场有效性。规则阈值未经训练、优化或盈利验证；confidence为规则完整度，非胜率。

未连接交易账户、未下单、未运行收益回测或策略表现统计。原Gold Pilot项目数据及Git历史未并入此仓库。

## Deployment preparation continuation — 2026-09-14

- Code verified: 37/37 local Node tests passed (original 32 plus 5 targeted deployment/timing checks). The expected public emission stage was updated to SIGNAL_READY; internal ACTIVE remains tested. Original proxy file has no diff.
- Production verified: NO. No Vercel link, Preview URL, Production URL or available authorization. Routing precedence, online old/new endpoints and cold-start durability remain NOT_RUN.
- Real Redis: NOT_RUN / UPSTASH_ENV_REQUIRED, verified by running scripts/validate-redis.js. Neither environment credentials nor .env.local were present.
- Signal logic verified: synthetic code-level gates only. Real cases A/C are NOT_VALIDATED; B also has a frozen-definition conflict (see DEPLOYMENT.md).
- Profitability NOT verified. No orders executed.
- Added: timing overlay, scanner stage/confidence/timestamp, debug booleans and CAS revision metadata, observed transition log, environment-separated state keys, read-only health endpoint, real Redis and online probe scripts.
- Remaining: live credentials/deployment/regression, measured scanner latency and quote-to-signal latency, real timestamped market acceptance, Vercel cold-start proof. PREPARE cannot truthfully publish a structural entry before a candidate exists. Logs are sampled state transitions, not a continuous market audit.
- Base HEAD: 6b5057d7ffbeacd02b6ddc18f707ea18608d0216. Changes remain uncommitted; git author name/email are not configured. This is the base commit, not a delivered deployment commit.

## First Retest definition revision — current result

Supersedes the earlier Case B conflict status. User authorized trigger-under/overrun when old structure is not reaccepted and HL/LH persists. Implemented first_retest_v2 / signal_rules_v2_first_retest, with a separate Redis namespace. See DEPLOYMENT.md for the exact two-close reclaim-boundary acceptance and completed-bar pivot confirmation conventions.

All tests rerun: 41/41 PASS (37 existing plus four focused retest tests). Coverage includes delayed below-trigger HL confirmation and point entry, unchanged risk/rating gates, two closes reaccepting old structure, retest structural failure, SELL symmetry, and original extreme breach. Existing incomplete-bar/gap/old-quote/retest-count/proxy compatibility regressions pass.

Case B RULE_CONFLICT_RESOLVED_IN_CODE: synthetic confirming entry 4332, structural SL 4328.01, risk 3.99, TP1 4340, TP2 4347, RR1 about 2.005, A / ALLOW_ORDER with otherwise valid gates. No live market path, exact requested entry interval, or profitability is claimed validated. Real timestamped market acceptance remains NOT_VALIDATED.

Code verified: 41 tests. Production verified: NO, and deployment is explicitly on hold. Redis live validation: NOT_RUN, credentials still required. Signal logic verified: synthetic fixtures only. Profitability NOT verified. Original four-interface proxy source unchanged.

## Watcher continuation

59/59 tests PASS. Added official QStash signature verification, POST watcher, GET events, atomic 200-event ring, deduplication, stale-quote freeze, stable SIGNAL_READY and post-emission no-chase observation. Six model detectors and legacy proxy unchanged. Simulated REST CAS, independent-client restart, PREPARE/ARMED/READY/MISSED/INVALIDATED/TP1/TP2, signed/unsigned/tampered/expired requests covered.

User reports live Redis persistence already verified. This turn did not independently rerun that live acceptance. setup-qstash.js returns NOT_CONFIGURED (credentials and destination absent); no recurring delivery claim. See WATCHER.md for Preview-only setup and protection bypass. Production not deployed; no orders or profitability calculation.

## Watcher live acceptance preparation

Added approved Preview default destination and per-execution CAS revision receipts (unchanged input no longer suppresses watcher heartbeat writes). 61/61 local tests pass, including five simulated calls advancing versions 1–5 while recording one transition, plus default-destination signature verification.

No remote QStash keys created or overwritten. User confirms existing Preview injection; independent presence verification and live five-delivery acceptance remain BLOCKED_BY_AUTHORIZATION. Local credential presence checks are false, .env.local and Vercel CLI auth/link files absent; attempted Vercel UI access timed out. No schedule creation or live state result is claimed.

## Machine Execution Contract V1

92/92 local tests PASS (existing 61 plus 31 execution tests); git diff --check required before commit. Added five-field execution endpoint, deterministic numerical macro gates, fixed structure-derived entry, dynamic ATR buffer, nearest-target RR constraint, macro permission/failure/resonance and atomic execution event deduplication. See MACHINE_EXECUTION_CONTRACT.md for exact definitions.

Real macro source validation NOT_COMPLETE: bridge root exposes /codes, but code discovery and FRED CSV probes timed out. No guessed symbols or synthetic macro input entered live logic. Independent FRED daily diagnostic adapter exists, remains ineligible for intraday execution and disabled by default. Critical live macro absence forces NONE. QStash schedule and injected keys unchanged; no claim of newly verified minute delivery. No Production deployment, orders or profitability statistics.

## Jin10 resource discovery only

100/100 tests PASS; added standard Streamable HTTP resources/read adapter and read-only /api/debug/jin10-codes plus /api/debug/jin10-macro. Existing generic proxy unchanged. No Worker source or wrangler configuration found in tracked branch/history; full inventory in JIN10_RESOURCE_DISCOVERY.md. Direct official MCP initialize returned 401 without credentials; bridge /codes and /tools timed out. No actual internal code, live quote or bars success is claimed. No third-party feed used and no Macro V2 integration performed. Original untracked package-lock.json remains outside this commit.

## Trading Economics multi-horizon adapter

117/117 tests PASS, including synthetic provider discovery/identity, live-vs-delayed/freshness, gap/duplicate/future-bar rejection, header-only credentials, change/bp arithmetic, deterministic weighted confirmation and structure-only prices. Real TE acceptance is NOT_VALIDATED: local credential absent; no actual symbols/quotes/histories claimed. Missing critical data forces NEUTRAL/NONE. See TRADING_ECONOMICS.md. Original four-interface proxy unchanged. No orders, backtest, optimization or Production deployment.

## FINAL BUILD V1

Supersedes prior TE live-integration and paper-study plans. Final runtime is DXY-only iTick + Jin10. 143 deterministic tests pass; no historical returns, win rates, optimization or performance claims. ACTIVE/alert tests use synthetic unit fixtures only. See FINAL_BUILD.md for rules, limits and deployment checks.

## Alert read contract revision

Email implementation/configuration/health checks removed. 148/148 tests pass, covering eight-field alert responses, material-change deduplication, stable timestamps, ACTIVE entry immutability, legacy state cleanup, stale/future watcher fail-closed reads, and unchanged five-field execution contract. No historical backtest or live trading. ChatGPT reads the alert endpoint; no direct push into an existing conversation.
