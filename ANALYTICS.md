# 埋点方案（无 PII 轻量分析）

> 目标：在**不采集任何个人身份信息**的前提下，拿到投资人会问的「漏斗 / 转化 / 病毒系数」数据。
> 当前为零配置即可运行；配置 Upstash 后自动升级为可聚合的真实埋点库。

## 1. 设计原则（合规）

- **不采集 PII**：无姓名 / 手机号 / 微信 openid / 邮箱 / 精确 IP。
- 仅用一个**本地随机匿名 sessionId**（localStorage）做去重，清缓存即重置，与身份无关。
- 服务端 `/api/event` 不读取请求 IP，只接受白名单事件 + 受限 props。
- 与项目「合规红线」一致：测试结果定位为**娱乐性参考**，本埋点不关联任何真实用户。

## 2. 事件清单

| 事件 | 触发点 | 用途 |
|------|--------|------|
| `page_view` | 任意路由访问（PageTracker 自动） | 流量 / 页面分布 |
| `test_start` | 落地页「开始寻找我的本命香」 | 漏斗起点 |
| `test_complete` | 用户**本人**完成测试（结果页读 localStorage） | 转化 |
| `result_view` | 通过 `?p=` 查看示例/他人结果 | 病毒触达（非转化） |
| `share_card_generate` | 生成六维分享图 | 分享意愿 |
| `friend_match_start` | 进入好友匹配页 | 社交起点 |
| `friend_match_complete` | 匹配结果算出（带 `tier`） | 社交转化 |

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
   {"event":"test_complete","props":{},"sessionId":"s_xxx","path":"/result","ts":...}
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

- `lib/analytics.ts` —— 客户端 `track()` + 匿名 sessionId
- `components/PageTracker.tsx` —— 路由级 `page_view`
- `app/api/event/route.ts` —— 匿名事件接收端点（白名单 + 清洗 + 零配置日志 / Upstash）
- 接入点：`app/layout.tsx`、`app/page.tsx`、`app/result/page.tsx`、`app/friend/FriendView.tsx`
