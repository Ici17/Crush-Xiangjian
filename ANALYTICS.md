# 埋点方案（无 PII 轻量分析）

> 目标：在**不采集任何个人身份信息**的前提下，拿到投资人会问的「漏斗 / 转化 / 病毒系数」数据。
> 当前为零配置即可运行；配置 Upstash 后自动升级为可聚合的真实埋点库。

## 1. 设计原则（合规）

- **不采集 PII**：无姓名 / 手机号 / 微信 openid / 邮箱 / 精确 IP。
- 仅用一个**本地随机匿名 sessionId**（localStorage）做去重，清缓存即重置，与身份无关。
- 服务端 `/api/event` 不读取请求 IP，只接受白名单事件 + 受限 props。
- 与项目「合规红线」一致：测试结果定位为**娱乐性参考**，本埋点不关联任何真实用户。

## 2. 事件清单（当前 29 个）

> 唯一真源：`lib/analytics/events.ts` 的 `TRACK_EVENTS`（新增事件只加这里，中文名同步补 `EVENT_LABEL`）。
> 顶层身份字段：`vid`（长期访客）/ `sid`（30 分钟滚动会话）/ `eid`（幂等 id）——永不进 `props`、不进 `DIM_KEYS`。

| 事件 | 触发点 | 关键 props | 用途 |
|------|--------|-----------|------|
| `page_view` | 任意路由访问（PageTracker 自动） | — | 流量 / 页面分布 |
| `test_start` | 落地页「开始寻找我的本命香」 | — | 漏斗起点 |
| `question_view` | 单题曝光 | `step` `phase` `qid` | 分步留存分母 |
| `question_answer` | 单题作答 | `step` `phase` `qid` `choice` | 选项分布 |
| `test_abandon` | 未完成即离开 | `step` `phase` | 流失定位 |
| `test_complete` | 本人完成测试 | `personality` | 转化 |
| `result_view` | 查看示例 / 他人结果 | `source` `personality` | 被动触达 |
| `share_card_generate` | 生成分享图 | `scene` `format` `context` | 分享意愿 |
| `share_guide_open` | 打开分享引导 | `context` | 分享引导 |
| `share_click` | 点击某个分享动作 | `channel` | 分享行为 |
| `download_card` | 真正拿到图 | `scene` `format` `context` | 分享完成 |
| `shared_landing_view` | `/shared` 落地页曝光 | `personality` | 裂变分母 |
| `shared_cta_click` | `/shared` CTA 点击 | `cta` | K 因子分子 |
| `friend_match_start` | 进入好友匹配页 | — | 社交起点 |
| `friend_match_complete` | 匹配结果算出 | `tier` | 社交转化 |
| `daily_draw` | 香签揭笺 | `sign` | 香签转化 |
| `codex_view` | 首页内嵌香气图鉴浏览 | — | 图鉴入口 |
| `paywall_view` | 付费墙曝光 | `context` `price` | 付费漏斗起点 |
| `pay_modal_open` | 解锁弹窗曝光 | `context` `price` | 弹窗转化 |
| `pay_claim` | 点击「去支付」 | `price` `context` | 支付意愿 |
| `pay_modal_close` | 主动关闭解锁弹窗 | `context` `price` | 弹窗内流失 |
| `unlock_success` | 解锁成功 | `level` | 付费转化 |
| `discover_tab_view` | 探索页 tab 曝光（含首次挂载） | `tab` | 探索入口分布 |
| `discover_action` | 探索页动作 | `tab` `action` `perfume?` | 探索动作分布 |
| `codex_page_view` | `/codex` 路由页图鉴曝光 | `litCount` | 独立图鉴入口 |
| `session_start` | 新会话首触（`track()` 自动） | — | 会话数 |
| `daily_view` | 香签面板曝光（含未揭笺） | `hasDrawn` | 曝光 → 揭笺流失 |
| `daily_streak` | 揭笺后 | `days` | 连续静候分布 |
| `error` | 埋点兜底异常（自动） | `scope` `status` | 丢数可观测 |

### 2.1 会话模型（第 2 批）

| 层 | 键 | 存储 | 生命周期 |
|----|----|------|----------|
| 访客 | `cx_vid` | localStorage | 永久（除非清缓存）；兼容迁移旧键 `cx_anon_session` |
| 会话 | `cx_sid` + `cx_sid_ts` | localStorage | 30 分钟滚动窗口 |

- `session_start` 由 `lib/analytics.ts` 的 `track()` 自动补发，调用点无需手动埋。
- 上报失败兜底：`sendBeacon` 返回 false / `fetch` 非 2xx → 入队 `cx_ev_queue`（上限 40 条 / 128KB），
  `online` / 切后台 / 加载后自动补发；每条带 `eid`，服务端按 eid 去重。
- `error` 事件仅 `scope='analytics'`，**绝不含错误文本 / 堆栈 / URL**。


## 3. 核心漏斗

```
test_start ──▶ test_complete ──▶ share_card_generate
                                      │
                                      ▼
friend_match_start ──▶ friend_match_complete
```

- **完成率** = test_complete / test_start
- **分享率** = share_card_generate / test_complete
- **病毒系数（KV）** ≈ （friend_match_start 中源自分享链接的占比）× 平均分享次数
- **社交转化** = friend_match_complete / friend_match_start

> `result_view`（示例/分享查看）单独统计，用于衡量「被动触达 → 主动开始测试」的转化，
> 不要把病毒触达误算成自己的完成。

## 4. 零配置模式（现在就能用）

未配置 Upstash 时，事件直接打到 **Vercel Functions 日志**：

1. Vercel Dashboard → 你的项目 → **Functions** → 选 `/api/event` → **Logs**。
2. 过滤 `[event]`，即可看到每条：
   ```json
   {"event":"test_complete","vid":"<访客>","sid":"<会话>","eid":"<幂等id>","props":{},"path":"/result","ts":...}
   ```
3. 本地联调：`next dev` 后控制台同样会打印 `[event] ...`。

适合先验证埋点是否生效，以及早期小流量人工看数。

## 5. 升级为可聚合埋点（Upstash Redis）

1. 注册 [Upstash](https://upstash.com)，建一个 Redis 数据库，拿到：
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
2. 在项目环境变量（Vercel Dashboard → Settings → Environment Variables，或 `.env.local`）配置这两个变量。
3. 重新部署。`/api/event` 检测到变量后，自动把每条事件 `LPUSH` 进列表 `cx_events`。

### 5.1 聚合脚本（示例）

```ts
// scripts/analytics_report.ts —— 读取 cx_events 并输出漏斗
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

async function main() {
  const raw = await redis.lrange('cx_events', 0, -1); // 生产建议分页 / 定时归档
  const events = raw.map((r) => JSON.parse(r as string));

  const count: Record<string, number> = {};
  const sessions = new Set<string>();
  for (const e of events) {
    count[e.event] = (count[e.event] ?? 0) + 1;
    if (e.sessionId) sessions.add(e.sessionId);
  }

  console.log('事件计数:', count);
  console.log('独立匿名会话(近似 UV):', sessions.size);
  const start = count['test_start'] ?? 0;
  const done = count['test_complete'] ?? 0;
  console.log('完成率:', start ? ((done / start) * 100).toFixed(1) + '%' : 'N/A');
}
main();
```

> 生产建议：列表会无限增长，应定时（如每日）用 Lua/`LRANGE`+`LTRIM` 归档到聚合表 / 数仓，
> 或直接接 Vercel 的 **Log Drains** / 第三方分析。

## 6. 隐私与合规声明（建议放到隐私页）

可在 `app/privacy/page.tsx` 增加一段：

> 本产品使用匿名行为统计（不含任何个人身份信息）。我们仅记录「访问了哪个页面 /
> 完成了哪一步」等聚合指标，用于改进产品；不收集您的姓名、联系方式、微信身份或设备指纹。
> 统计使用的随机匿名标识仅存于您本地浏览器，清除缓存后即失效。

## 7. 文件清单

- `lib/analytics/events.ts` —— 事件 / 维度 / 标签「唯一真源」（`TRACK_EVENTS` / `DIM_KEYS` / `EVENT_LABEL` / `AUTO_EVENTS`）
- `lib/analytics.ts` —— 客户端 `track()` + 访客 / 会话双层 ID + 上报兜底队列
- `lib/analytics/store.ts` —— 服务端落地（Supabase / KV / file / log）+ 读写共享的 KV 每日布局
- `components/PageTracker.tsx` —— 路由级 `page_view`
- `app/api/event/route.ts` —— 匿名事件接收端点（白名单 + 清洗 + 零配置日志 / Upstash / Supabase）
- `scripts/audit-analytics.ts` —— 埋点门禁（A–H：白名单 / 死埋点 / 标签 / 单一真源 / 总数 / KV 布局）
- `scripts/supabase-schema.sql` —— 建表 + 第 2 批 `sess` / `eid` 列 DDL（幂等，手动执行）
