# gold-vercel-bridge

金十桥接接口＋XAUUSD 规则信号引擎。只输出候选策略，不连接交易账户、不下单。

## 接口兼容

`api/[...path].js` 保持原样；`/api/quote`、`/api/bars`、`/api/calendar`、`/api/flash` 的路径、重复 query 参数、上游状态码、响应正文、CORS、OPTIONS 与错误行为均保持。新增三个具体路径：

| GET 路径 | 内容 |
| --- | --- |
| `/api/signal/xauusd` | 完整信号、理由、风险、宏观证据、数据质量 |
| `/api/scanner/xauusd` | 精简方向、评级、Entry/SL/TP、signal_id |
| `/api/debug/xauusd` | 完整信号加确认时间线、条件布尔值、回踩计数、观测价格路径 |

三个接口共享同一状态服务和存储键；相同市场快照复用同一个结果，不能把每次 GET 当作新交易。客户端以 `signal_id` 去重。仅返回数值计划，不发送订单。报价为 `JIN10_INDICATIVE_CLOSE`，没有用它冒充 bid/ask 成交价；RR 未扣除未知 spread/slippage，`ALLOW_ORDER` 表示规则准入，不是保证成交或保证盈利。

## 运行

Node.js 22+，无第三方 npm 依赖：

```sh
npm test
npm run dev
```

等价命令为 `node --test` 和 `node scripts/dev.js`。本机禁止测试子进程时可用 `node --test --test-isolation=none`。本地监听 `127.0.0.1:3000`。不自动部署、不自动启动扫描任务。

Vercel 使用 `/api` Node Functions。保留原 catch-all，三个新增路径为独立具体文件；没有新增覆盖旧接口的 rewrite。部署参考 [Vercel Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js)。

## 持久状态

生产环境设置环境变量 `UPSTASH_REDIS_REST_URL`、`UPSTASH_REDIS_REST_TOKEN`，不可写入源码。兼容 Redis REST 的 GET 和 EVAL；Lua CAS 原子比较旧快照后写入新快照，避免多个实例同时推进、重复统计回踩。固定键 `gold:jin10:xauusd:signal_rules_v1`，7天无活动过期。改变规则版本应使用新键，不混用旧状态。

没有配置时使用进程内存观察模式，明确 `state_durable=false`，不会产生 ALLOW_ORDER。存储错误返回 503 / NO_TRADE，不回退到虚假的可交易状态。当前尚未连接真实生产 Redis，适配器与并发语义由模拟测试覆盖。

## 数据与时序

- 从既有 Worker 的 quote、M5(30)、M15(20)、calendar、黄金/美联储 flash 并行读取，单源8秒超时；单个失败不终止其他数据源。
- quote 优先使用原始 `freshness.quote_time`/`data.time`，默认90秒过期；拒绝未来时间、错 instrument、上游 stale。抓取时间不替代报价时间。
- 确认 bar 必须 `complete === true`、M5 `m1_count === 5` / M15 `=== 15`，且 UTC 边界已闭合、OHLC合理。重复时间全部隔离；乱序排序并标记。缺口不填充、不插值。修订已确认OHLC将撤销当前候选，不重写既有确认历史。
- M5 驱动确认状态机；M15 提供较高周期背景/目标位置。M5不足时保留最后可靠历史、quote路径、日内open/high/low继续观察；M15不足会降置信度，不把未完成bar用于确认。最新连续三根 M5、最后一根不超过10分钟才允许确认准入。
- 冷启动只暖机。若历史窗口已经包含首次回踩，该候选永不因下一次相同请求转为新信号；需等待新的完整机会。
- 当前 previous_session 是 UTC 00/08/16 三个8小时窗口的实际已观测 quote 高低，标记 `OBSERVED_QUOTES_ONLY`，不冒充完整伦敦/纽约 session 数据或 DST 日历。日高低开使用桥接源口径，来源没有明确提供其交易日边界。

## 版本化工程规则

版本 `signal_rules_v1`，集中参数见 `config/policy.js`。以下是可解释的第一版定义，未训练、未优化，不能描述为已验证的交易优势。

| 模型 | 触发链 |
| --- | --- |
| R1 / R2 | 前置下跌/上涨、三个新极值延伸缩小且回弹扩大、震荡、扫区间边沿收回、突破已确认 swing、后续首次回踩收盘守住 |
| V1 / V2 | 最近三个单向实体、末段动量相对首段加速、累计移动足够大、扫旧 swing 回收、后续结构突破、后续首次回踩 |
| C1 / C2 | 已形成震荡边沿突破收盘、下一完整bar再次收在外侧完成 acceptance/结构突破、之后首次回踩收盘守住 |

Swing：左右各一根完整且连续K线的严格局部极值，右侧bar收盘才可知。结构突破使用收盘而非单个wick；V/R不会直接抄 extreme。C模型的结构参考为已有 range 边沿，不能把尚未接受的突破判为结构确认。

震荡：最近四根连续bar，上下四分位均至少两次触达，净漂移不超过总range的35%，平均实体不超过range的45%。V代理：最后三根同方向实体，末根至少首根1.5倍，累计实体至少平均high-low的2倍。这些阈值仅是工程假设，debug提供证据，不是人类形态标签的统计等价物。

Sweep/Reclaim 可以在同一完整bar确认；MSS必须在其后的bar确认，Retest必须在MSS后的bar确认。每个阶段记录 `bar_at` 与当时 `end`，不回填。连续接触是同一次回踩，离开后再回来才增加次数。第二次为 B / OBSERVE；第三次撤销。

动态Level为单价对象。新日高低和swing会产生新对象，保留有限历史；原日高经过其事前登记之后的两根完整bar收在上方，迁移为 SUPPORT_CANDIDATE，低点镜像。没有给单价随意扩宽为Zone。Entry区间来自真实回踩收盘与trigger之间的范围。

## 风险与动作

SL = 已确认回踩 extreme 外一档 0.01 美元报价格点，不能为了≤5美元而收紧。Entry用当前quote；风险必须>0且≤5，2.5–4仅为偏好。TP1取最近、已可见的前方Level；不足2R即拒绝，不跳过近处障碍来虚增RR。TP2取第二个真实Level，无则null，不制造3R目标。

区间中部 `(0.35,0.65)` 没有趋势或结构确认则不允许交易。A为完整价格结构＋首次回踩＋风险通过；A+还要求RR≥2.5、宏观匹配/失败证据与完整M5/M15质量；B只观察，C不交易。`confidence` 是固定规则完整度指标，不是胜率、预测概率或回测评分。

WAIT → RECLAIM / BREAKOUT_TEST → STRUCTURE_SHIFT → SIGNAL_READY → ACTIVE → TP1 / TP2 或 INVALIDATED。Sweep/Acceptance/First Retest保存在事件时间线。ACTIVE仅表示信号已发布，TP状态仅表示后续抽样quote达到参考价，不能证明成交或真实盈亏；缺口标记 monitoring_gap。没有 target/stop 盈利统计，也不根据上次失效立即反手。

## 宏观

只保留过去一小时且不晚于当前时刻的快讯，未来内容排除。关键词用于主题筛选；方向仅依据明确“利多/利好黄金、利空黄金”文本，条件预测/否定表达排除。泛化 `affect_txt=利多` 不能证明利多黄金。证据不足为NEUTRAL或PARTIAL；相反信息为MIXED。

MACRO_CONFIRMATION / FAILURE 的方向证据必须早于该价格事件，宏观不能独立生成交易。重要美国数据附近±15分钟为观察过滤；日历无时区字符串显式按金十北京时间解析。该层是保守文本规则，不是全面语义理解，也不是历史PIT数据验证。

## 验证范围

`node --test` 覆盖六类模拟序列、假回收/突破、时序、缺口、三次回踩、区间中部、SL>5、RR不足、宏观未来信息、冷启动、重复请求、修订bar、接口兼容及CAS。测试不使用收益标签。

`node scripts/smoke.js` 为单次只读线上连通测试，观察模式不发信号。若本机Node直连网络受限，可用 `scripts/smoke-windows.ps1` 通过Windows HTTPS传输验证实际schema；这不能代替Vercel部署环境的连通验收。尚未验证生产部署、真实Redis、真实交易执行或盈利能力。

Deployment stage status and configuration: see [DEPLOYMENT.md](DEPLOYMENT.md). New read-only health route: GET /api/health/signal. No production acceptance is claimed.
