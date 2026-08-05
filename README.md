# Crush 香鉴 — 开发文档

> 你的灵魂，藏在哪种香气里？
> 10 道情境题 × 16 种人格 × 110 款本命香水

一个纯前端的香气人格测试 H5（Next.js 16 + TypeScript + Tailwind v4）。无后端、无数据库、零 OpenID；支付通过 Waffo Pancake 匿名结账 + 本地乐观解锁完成。

---

## 🏗 当前进度

### ✅ 已完成（骨架 + 核心逻辑 + 商业化）
- [x] Next.js 16 + TypeScript + Tailwind CSS v4 项目初始化
- [x] 16 种人格类型完整数据（名字、香调向量、隐藏人格面、反差香、气味底稿、香水推荐、性格报告）
- [x] 110 款香水数据库（中英品牌名、三调香料、扩散力/留香评级）
- [x] 10 道情境向量问卷（7 题分支 + 3 题校准，二叉树路径）
- [x] 人格匹配算法（余弦相似度 + 频率去偏）
- [x] 落地页（首页 + 社会证明 + CTA 脉冲动效）
- [x] 问卷页（答题 + 进度保存 localStorage + 过渡动画 + 气味暗示加载页）
- [x] 结果页（人格卡片 + 雷达图 + 本命香水 3 档推荐 + 香气探索路径）
- [x] 解锁版内容（隐藏人格面 / 反差香 / 气味底稿 / 关系解读 / 使用场景指南）
- [x] 付费墙（完整版 ¥6.6 裂变价 / ¥9.9 主推，一次性香气盒 ¥59.9）
- [x] Waffo Pancake 支付集成（匿名 checkout → 跳转收银台 → 回调查单乐观解锁）
- [x] 朋友匹配页 `/friend`（雷达对比图 + 契合度计算 + 邀请闭环）
- [x] 分享图生成（html2canvas 截图下载）
- [x] 分享页 `/shared`（路由层转发，聊天卡片 meta 展示邀请方结果，进入即自己的测试页）
- [x] 预览页 `/preview`（解锁版演示）
- [x] 服务条款 `/terms` 与隐私政策 `/privacy`
- [x] PWA manifest + service worker
- [x] "重开仍同批" 缓存（动态推荐写入 localStorage，关浏览器重开仍显示同一批香水）

### 🔲 待开发 / 推迟（v2）
- [ ] 微信卡片 `og:title` / 卡片图片（需认证服务号 + JS-SDK，v2 推迟）
- [ ] 跨设备结果同步（需后端 inviteId → 受邀人 mapping，当前仅 localStorage 单设备）
- [ ] 一次性香气盒真实寄送履约（当前卡片 + 支付已就绪，履约后台待接）
- [ ] 雷达图改用 Recharts（当前为 SVG 自绘，已可用）
- [ ] 更多人格测试用例

---

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（见下方 .env.local）
cp .env.local.example .env.local   # 或手动创建

# 3. 开发模式
npm run dev
# 打开 http://localhost:3000

# 4. 生产模式（双进程：静态代理 + API）
npm run build
npm run serve:api   # 终端 A：next start -p 3457（API 与页面）
npm run serve       # 终端 B：serve.mjs 在 3456 反代 /api/* 到 3457
# 打开 http://localhost:3456
```

> 生产环境由 `serve.mjs` 在 3456 端口提供静态页 + 反代 `/api/*` 到 3457 的 `next start`。
> 单设备调试可直接 `npm start`（即 `next start -p 3457`），但线上走 serve.mjs。

---

## 🔧 配置环境变量

创建 `.env.local`（支付走 Waffo，无 Supabase）：

```env
# Waffo Pancake 支付（必需，否则支付按钮无法生成订单）
WAFFO_MERCHANT_ID=MER_xxxxxxxxxxxxxxxx
WAFFO_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
...RSA PEM 私钥...
-----END PRIVATE KEY-----

# Waffo 后台创建的三个产品 ID（分别对应三档）
NEXT_PUBLIC_WAFFO_PRODUCT_DISCOUNTED=PROD_xxxxxxxx   # 完整版裂变价 ¥6.6
NEXT_PUBLIC_WAFFO_PRODUCT_FULL=PROD_xxxxxxxx         # 完整版主推 ¥9.9
NEXT_PUBLIC_WAFFO_PRODUCT_SUBSCRIPTION=PROD_xxxxxxxx # 一次性香气盒 ¥59.9

# 站点基础 URL（回调 / 分享链接用）
NEXT_PUBLIC_BASE_URL=http://localhost:3456
```

> 微信/支付宝个人收款二维码方案（`lib/payment.ts` 中的 `PAYMENT_QR` / `isWechatBrowser`）为早期遗留占位，当前支付以 Waffo 跳转为主路径。

---

## 📂 项目结构（当前）

```
crushxiangjian/
├── app/
│   ├── layout.tsx          # 根布局（PWA meta + 字体）
│   ├── globals.css         # 品牌色彩 + Tailwind v4 主题 + CTA 动效
│   ├── page.tsx            # 落地页（首页 + 社会证明 + CTA 脉冲）
│   ├── question/
│   │   └── page.tsx        # 问卷页（分叉题 + 校准 + 过渡动画）
│   ├── result/
│   │   └── page.tsx        # 结果页（雷达图 + 本命香水 + 付费墙 + 解锁版）
│   ├── preview/
│   │   └── page.tsx        # 解锁版演示页（?demo=人格&previewPaid=1）
│   ├── shared/
│   │   ├── page.tsx        # 分享路由层（转发到 /result 或 /question?inv=）
│   │   └── SharedView.tsx  # 分享卡（?skip=1 调试渲染）
│   ├── friend/
│   │   ├── page.tsx        # 朋友匹配页入口
│   │   └── FriendView.tsx  # 雷达对比 + 契合度 + 邀请闭环
│   ├── terms/page.tsx      # 服务条款
│   ├── privacy/page.tsx    # 隐私政策
│   └── api/
│       ├── checkout/route.ts  # Waffo 匿名创建订单 → 返回 checkoutUrl
│       ├── order/route.ts     # Waffo 查单 → 解析档位 → 解锁
│       └── og/route.tsx       # 动态 OG 图
├── components/
│   ├── PaymentModal.tsx       # 支付弹窗（跳转收银台）
│   ├── UnlockedContent.tsx    # 解锁版完整内容（隐藏面/反差香/底稿/关系）
│   ├── ComparisonRadarChart.tsx  # 朋友对比雷达图
│   └── SiteFooter.tsx         # 全站页脚（定价说明 + 客服邮箱 + 法律链接）
├── lib/
│   ├── data.ts             # 16 人格 + 110 香水 + 问卷 + 匹配算法
│   ├── personalities.ts    # 人格扩展数据（隐藏面/反差香/底稿/推荐缓存）
│   ├── payment.ts          # 三档价格配置 + localStorage 解锁状态
│   ├── waffo.ts            # Waffo Pancake SDK 单例
│   ├── friendMatch.ts      # 朋友契合度计算
│   ├── inviteState.ts      # 邀请状态同步（跨标签 + polling）
│   └── useMyTestStatus.ts  # 读取本机测试状态
├── public/
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # service worker
│   └── icons/              # 图标
├── serve.mjs               # 生产静态代理 + /api/* 反代
└── package.json
```

---

## 💰 定价模型（一次性，无订阅）

| 档位 | 价格 | 说明 |
|------|------|------|
| 完整版解锁（裂变价） | ¥6.6 | 转发 3 人后解锁，原价 ¥9.9 |
| 完整版解锁（主推） | ¥9.9 | 原价 ¥19.9，5 折 |
| **一次性香气盒** | **¥59.9** | 实物寄送：依人格甄选**一支 15ml 小众孤香小样**（不透露品牌，只匹配香调），附用香指南卡片，全国包邮，**一次付清，无自动续费** |

支付完成后立即解锁，无自动续费。退款政策见 `/terms`（7 天内因技术故障可全额退款）。
客服邮箱：`hi@crushxiangjian.com`

---

## 🎨 品牌设计规范

| 属性 | 值 |
|------|-----|
| 主色 | #2C1810（深琥珀） |
| 强调色 | #D4A574（暖琥珀） |
| 背景色 | #FAF3EA（奶油白） |
| 字体-标题 | Noto Serif SC（衬线） |
| 字体-正文 | Noto Sans SC（无衬线） |
| 圆角 | 0.75rem / 1.25rem / 2rem |
| 阴影 | 0 4px 24px rgba(139,111,92,0.15) |

---

## 🌐 部署

生产由 `serve.mjs`（3456）反代 `/api/*` 到 `next start`（3457）：

```bash
npm run build
npm run serve:api   # 终端 A
npm run serve       # 终端 B
```

- 前端：可部署到 Vercel / 腾讯云 / 任意 Node 主机
- 支付：Waffo Pancake（无需自有商户号，匿名结账）
- 域名：namesilo / 腾讯云（.com）；国内访问需备案 + HTTPS

> ⚠️ 微信内 H5 打开需完成域名备案；建议先海外/香港服务器验证，备案后再切换。

---

Adam，骨架 + 核心 + 商业化全部就位。打开 Cursor 接着干吧！🚀
