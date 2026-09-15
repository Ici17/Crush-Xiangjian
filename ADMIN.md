# Crush香鉴 · 数据后台（/admin）使用与部署说明

> 一个轻量、无 PII 的自建数据看板。访问路径：`https://crushxiangjian.com/admin`

## 1. 能看到什么

| 模块 | 内容 |
|------|------|
| 概览卡片 | 区间去重访客 / 累计访客 / 新访客 / PV / 完成测试 / 完成率·分享率 |
| 每日趋势 | 近 N 天 PV 与「完成测试」双柱图（悬停显示 UV、分享数） |
| 核心漏斗 | 页面访问 → 开始测试 → 完成测试 → 生成分享图（含占首步、环比） |
| 人格分布 | 16 种人格的测试产出占比 |
| 来源渠道 | 微信 / 小红书 / 抖音 / 百度 / 直接访问 等（首次来源归因） |
| 好友匹配 | 匹配开始 → 完成，及契合档位（tier）分布 |
| 付费转化 | 解锁弹窗曝光 → 点击去支付 → 解锁成功，含档位与入口场景 |
| 页面 TOP | 各路由访问排行 |
| 最近事件 | 最新 100 条原始事件（时间 / 事件 / 页面 / 属性） |
| 导出 | 一键导出 CSV（含事件汇总、每日趋势、人格、来源） |

时间区间可切换：近 7 / 14 / 30 / 90 天。

## 2. 上线三步（Vercel）

### 2.1 创建 KV 存储（30 秒）

1. Vercel Dashboard → 项目 `crushxiangjian` → **Storage** → **Create Database** → 选 **KV（Upstash Redis）**
2. 区域选与你函数最近的（如 `hkg1` / `sin1`）
3. 创建后点 **Connect Project**，Vercel 会自动注入：
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
4. **Redeploy** 一次（环境变量变更后需重新部署）

代码会自动探测这两个变量（也兼容 Upstash 原生的 `UPSTASH_REDIS_REST_URL/TOKEN`），无需改任何代码。
免费额度（每月 10 万次命令）对当前量级绰绰有余。

### 2.2 设置后台口令（必做）

Vercel → Settings → **Environment Variables** 增加：

```
ADMIN_PASSWORD = 你自己的强口令
```

> **线上不配置 `ADMIN_PASSWORD` 时，后台会被主动禁用**（返回 503），避免裸奔。
> 本地 `next dev` 未配置时默认口令为 `crush2026`，仅供开发。

### 2.3 打开后台

访问 `/admin`，输入口令即可。登录态是 httpOnly cookie，有效期 7 天。

## 3. 数据存在哪（驱动自动探测）

| 驱动 | 触发条件 | 说明 |
|------|----------|------|
| `kv` | 有 KV / Upstash 环境变量 | **线上真实持久化**，看板顶部显示「存储：Vercel KV」 |
| `file` | 本地 `next dev` | 写入项目内 `.data/analytics.json`（已 gitignore），看板顶部会红色提醒「未接 KV，数据不持久」 |
| `log` | KV 写失败时兜底 | 仅打函数日志，不报错、不影响主流程 |

Redis 键结构（前缀 `cx:`）：

- `cx:ev` — 原始事件列表（`LPUSH` + `LTRIM 0 4999`，只留最近 5000 条）
- `cx:d:{YYYY-MM-DD}` — 当日事件计数 Hash
- `cx:d:{date}:uv` — 当日访客 HyperLogLog（只存匿名 sessionId 的基数，**不存明文**）
- `cx:uv:all` — 全局访客 HyperLogLog，用于判断「新老访客」
- `cx:d:{date}:dim:{key}` — 维度计数 Hash（`path` / `personality` / `ref` / `price` / `tier` / `scene` / `sign` …）

## 4. 埋点事件清单

| 事件 | 触发点 | 关键 props |
|------|--------|-----------|
| `page_view` | 任意路由（PageTracker 自动） | `path`, `ref` |
| `test_start` | 首页点「开始我的测试」 | — |
| `test_complete` | 本人完成测试 | `personality` |
| `result_view` | 看示例 / 他人结果 | `source`, `personality` |
| `share_card_generate` | 生成分享图 | `scene`, `format`, `personality` |
| `share_guide_open` / `share_click` / `download_card` | 分享引导与下载 | `channel` |
| `friend_match_start` / `friend_match_complete` | 好友匹配 | `tier` |
| `daily_draw` | 今日香签揭笺（每日每会话一次） | `sign`（稀有度） |
| `codex_view` | 打开香气图鉴 | — |
| `pay_modal_open` | 解锁弹窗曝光 | `context`, `price` |
| `pay_claim` | 点「去支付」 | `price`, `context` |
| `unlock_success` | 解锁成功 | `price`, `level` |

> 服务端只接受白名单事件，props 经清洗（只留标量、key 限字符集、value 限 64 字符），
> **不读取请求 IP / UA / x-forwarded-for**，不做任何身份关联。

## 5. 本地联调

```bash
npm run dev                      # 起服务（默认 3000 / 项目常用 3456）
node scripts/seed-analytics.mjs  # 可选：灌 14 天模拟数据，看板立刻有数
```

然后访问 `http://localhost:3456/admin`，口令 `crush2026`。

## 6. 合规

- 全部指标基于匿名事件：无姓名、手机号、邮箱、微信 openid、精确 IP、设备指纹。
- 匿名 sessionId 随机生成后只存用户本地 localStorage，清缓存即重置，与真实身份无任何关联。
- 来源（referrer）在浏览器端就归一化为渠道名（如「小红书」），**不上传完整 URL**，避免携带隐私参数。
- 隐私政策口径：仅记录「访问了哪个页面 / 完成了哪一步」的聚合指标，用于改进产品。
