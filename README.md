# Crush 香鉴 - 开发文档

> 你的灵魂,藏在哪种香气里?
> 10 道情境题 × 16 种人格 × 225 款本命香水

一个纯前端的香气人格测试 H5(Next.js 16 + TypeScript + Tailwind v4)。无后端、无数据库、零 OpenID;支付走预留接口 + 本地乐观解锁完成。

---

## 🏗 当前进度

### ✅ 已完成(骨架 + 核心逻辑 + 商业化)
- [x] Next.js 16 + TypeScript + Tailwind CSS v4 项目初始化
- [x] 16 种人格类型完整数据(名字、香调向量、隐藏人格面、反差香、气味底稿、香水推荐、性格报告)
- [x] 225 款香水数据库(中英品牌名、三调香料、扩散力/留香评级)
- [x] 10 道情境向量问卷(7 题分支 + 3 题校准,二叉树路径)
- [x] 人格匹配算法(余弦相似度 + 频率去偏)
- [x] 落地页(首页 + 社会证明 + CTA 脉冲动效)
- [x] 问卷页(答题 + 进度保存 localStorage + 过渡动画 + 气味暗示加载页)
- [x] 结果页(人格卡片 + 雷达图 + 本命香水 3 档推荐 + 香气探索路径)
- [x] 解锁版内容(隐藏人格面 / 反差香 / 气味底稿 / 关系解读 / 使用场景指南)
- [x] 付费墙(完整版 ￥20.9 裂变价 / ￥29.9 主推)+ 预留支付接口(initiatePayment,未来接微信/支付宝/Stripe)
- [x] 朋友匹配页 `/friend`(雷达对比图 + 契合度计算 + 邀请闭环)
- [x] 分享图生成(html2canvas 截图下载)
- [x] 分享页 `/shared`(路由层转发,聊天卡片 meta 展示邀请方结果,进入即自己的测试页)
- [x] 预览页 `/preview`(解锁版演示)
- [x] 服务条款 `/terms` 与隐私政策 `/privacy`
- [x] PWA manifest + service worker
- [x] "重开仍同批" 缓存(动态推荐写入 localStorage,关浏览器重开仍显示同一批香水)

### ✅ 已完成(v2 · 今日香签 / 守护香 / 留存互动)
- [x] **今日香签 · 静候揭笺**:首页顶部胶囊切换进入;长按 1.5s 静候 → 三笺逐张启笺
- [x] **确定性抽签**:以日期为种子(mulberry32 + Fisher-Yates),全员当日同签,页面与分享卡结果一致
- [x] **16 人格本命守护香**:匈牙利算法最优不重复分配,每人格一支 premium 香水;结果页 / 图鉴可展示
- [x] **香气图鉴**:16 守护香网格 + 本命认领高亮 + 收集进度 X/16
- [x] **今日宜忌 · 留白卡**:确定性宜 3 / 忌 3 + 今日一语,合规只讲情绪与审美;限 20 字留白批注
- [x] **香气历 · 连续静候**:连续天数 / 续签令牌(freeze)/ 7·30·100·365 天称号 / 月历墨点
- [x] **今日之瓶 · 香水瓶演示**:揭笺后底部浮现,液体按稀有度升起 + 瓶口飘香,收束页面留白
- [x] **今日香签分享卡**:satori 出 1:1 / 3:4 签面,内嵌宜忌与今日一语,增强晒图

### 🔲 待开发 / 推迟(v2)
- [ ] 微信卡片 `og:title` / 卡片图片(需认证服务号 + JS-SDK,v2 推迟)
- [ ] 跨设备结果同步(需后端 inviteId → 受邀人 mapping,当前仅 localStorage 单设备)
- [ ] 香气产品实物寄送履约（待定）
- [ ] 雷达图改用 Recharts(当前为 SVG 自绘,已可用)
- [ ] 更多人格测试用例

### ✅ 已完成(v2 · 互动 / 裂变 / 增长)
- [x] **④ 本命守护香常驻卡**:结果页揭晓区后固定展示本命守护香(复用 v2 匈牙利分配结果),常驻不随解锁状态消失
- [x] **⑤ Phase 2 仪式动效**:揭笺「香烟袅袅」长按 1.5s 香头渐亮 + 三缕烟雾(SVG + CSS,非 Three.js);节气 / 月相「隐签之夜」(隐签之夜取精确正日 ±0.5 天,情绪基调切换)
- [x] **⑥ 香气共鸣 / CP 共振**:双人组合种子比对(`lib/cpResonance.ts`),算互补 / 差 0~3 调,生成合香卡 `CpBlendCard`;合香名可交换排序(A×B==B×A 同名),分享卡注入合香行
- [x] **⑦ 增长裂变**(纯免费增长,不接付费):
  - **合香分享裂变·两轨**:① 好友页分享入口生成 `?cp=A|B` 双人链接,受邀方进入即看到双方合香预览 + 点亮图鉴;② 「保存合香海报」走 satori 出图下载,两轨可独立使用
  - **气味 CP 图鉴(256 点亮式)**:`/codex` 路由 + 16×16 网格(`components/CpCodex.tsx`),任意两人组合点亮一格,进度 X/256,详情弹层展示合香名 / 隔几调 / 基调
  - 合规:不强制分享解锁、只讲情绪与审美、无吉凶 / 桃花 / 命定恋人

### 🔜 探索中(后续可排期,非阻塞)
- [ ] 微信卡片 `og:image` 动态化(合香卡 / 图鉴进度晒图)
- [ ] 跨设备图鉴同步(localStorage → 云端,需后端)
- [ ] 图鉴点亮成就卡 / 连续点亮称号激励

---

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量(见下方 .env.local)
cp .env.local.example .env.local   # 或手动创建

# 3. 开发模式
npm run dev
# 打开 http://localhost:3000

# 4. 生产模式(双进程:静态代理 + API)
npm run build
npm run serve:api   # 终端 A:next start -p 3457(API 与页面)
npm run serve       # 终端 B:serve.mjs 在 3456 反代 /api/* 到 3457
# 打开 http://localhost:3456
```

> 生产环境由 `serve.mjs` 在 3456 端口提供静态页 + 反代 `/api/*` 到 3457 的 `next start`。
> 单设备调试可直接 `npm start`(即 `next start -p 3457`),但线上走 serve.mjs。

---

## 🔧 配置环境变量

创建 `.env.local`(支付预留接口,无 Supabase):

```env
# 支付(当前未接入服务商;付费墙走预留接口 lib/payment.ts → initiatePayment)
# 未来接入微信/支付宝/Stripe 时,在此登记对应服务商密钥与产品 ID

# 站点基础 URL(回调 / 分享链接用)
NEXT_PUBLIC_BASE_URL=http://localhost:3456
```

> 微信/支付宝个人收款二维码方案(`lib/payment.ts` 中的 `PAYMENT_QR` / `isWechatBrowser`)为早期遗留占位,当前支付以预留接口为主路径。

---

## 📂 项目结构(当前)

```
crushxiangjian/
├── app/
│   ├── layout.tsx          # 根布局(PWA meta + 字体)
│   ├── globals.css         # 品牌色彩 + Tailwind v4 主题 + CTA 动效
│   ├── page.tsx            # 落地页(首页 + 社会证明 + CTA 脉冲)
│   ├── question/
│   │   └── page.tsx        # 问卷页(分叉题 + 校准 + 过渡动画)
│   ├── result/
│   │   └── page.tsx        # 结果页(雷达图 + 本命香水 + 付费墙 + 解锁版)
│   ├── preview/
│   │   └── page.tsx        # 解锁版演示页(?demo=人格&previewPaid=1)
│   ├── shared/
│   │   ├── page.tsx        # 分享路由层(转发到 /result 或 /question?inv=)
│   │   └── SharedView.tsx  # 分享卡(?skip=1 调试渲染)
│   ├── friend/
│   │   ├── page.tsx        # 朋友匹配页入口
│   │   └── FriendView.tsx  # 雷达对比 + 契合度 + 邀请闭环 + 合香预览
│   ├── codex/
│   │   └── page.tsx        # 气味 CP 图鉴(256 点亮式网格 + 进度)
│   ├── terms/page.tsx      # 服务条款
│   ├── privacy/page.tsx    # 隐私政策
│   └── api/
│       ├── og/route.tsx       # 动态 OG 图
│       └── share-card/route.ts  # 分享卡(satori:result / daily 多场景)
├── components/
│   ├── PaymentModal.tsx       # 支付弹窗(跳转收银台)
│   ├── UnlockedContent.tsx    # 解锁版完整内容(隐藏面/反差香/底稿/关系)
│   ├── ComparisonRadarChart.tsx  # 朋友对比雷达图
│   ├── DailyPanel.tsx        # 今日香签面板(静候揭笺 + 宜忌 + 留白 + 香气历)
│   ├── PerfumeBottle.tsx     # 香水瓶线稿(SVG,结果页 / 解锁版 / 今日之瓶复用)
│   ├── PerfumeBottleShowcase.tsx  # 今日之瓶·香水瓶演示(液体升起 + 飘香)
│   ├── ScentCodex.tsx        # 香气图鉴(16 守护香网格 + 本命认领)
│   ├── GuardianScentCard.tsx  # ④ 本命守护香常驻卡(结果页)
│   ├── IncenseRitual.tsx      # ⑤ 揭笺「香烟袅袅」(SVG + CSS)
│   ├── CpBlendCard.tsx        # ⑥⑦ 合香卡(好友页 + 分享裂变)
│   ├── CpCodex.tsx            # ⑦ 气味 CP 图鉴(16×16 网格 + 进度)
│   └── SiteFooter.tsx         # 全站页脚(定价说明 + 客服邮箱 + 法律链接)
├── lib/
│   ├── data.ts             # 16 人格 + 110 香水 + 问卷 + 匹配算法
│   ├── personalities.ts    # 人格扩展数据(隐藏面/反差香/底稿/推荐缓存)
│   ├── payment.ts          # 三档价格配置 + localStorage 解锁状态 + 预留支付接口
│   ├── friendMatch.ts      # 朋友契合度计算
│   ├── inviteState.ts      # 邀请状态同步(跨标签 + polling)+ cp 双人编解码
│   ├── useMyTestStatus.ts  # 读取本机测试状态
│   ├── cpResonance.ts      # ⑥ 双人组合种子比对 / 合香
│   ├── cpCodex.ts          # ⑦ 图鉴点亮记录(localStorage,对称双亮)
│   └── daily/
│       ├── draw.ts         # 今日香签确定性抽签(日期种子)
│       ├── almanac.ts      # 今日宜忌(宜 3 / 忌 3 / 今日一语)
│       ├── history.ts      # 香气历(连续静候 / 续签令牌 / 称号 / 月历墨点)
│       └── night.ts        # ⑤ 节气 / 月相 / 隐签之夜
├── public/
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # service worker
│   └── icons/              # 图标
├── serve.mjs               # 生产静态代理 + /api/* 反代
└── package.json
```

---

## 💰 定价模型(一次性,无订阅)

| 档位 | 价格 | 说明 |
|------|------|------|
| 完整版解锁(裂变价) | ¥20.9 | 转发 3 人后解锁,原价 ¥29.9 |
| 完整版解锁(主推) | ¥29.9 | 原价 ¥59.9,5 折 |

> 实物香气盒(￥59.9)已于 v1.1 下架,当前仅保留数字版付费墙。支付完成后立即解锁,无自动续费。退款政策见 `/terms`(7 天内因技术故障可全额退款)。
客服邮箱:`hi@crushxiangjian.com`

---

## 🎨 品牌设计规范

| 属性 | 值 |
|------|-----|
| 主色 | #2C1810(深琥珀) |
| 强调色 | #D4A574(暖琥珀) |
| 背景色 | #FAF3EA(奶油白) |
| 字体-标题 | Noto Serif SC(衬线) |
| 字体-正文 | Noto Sans SC(无衬线) |
| 圆角 | 0.75rem / 1.25rem / 2rem |
| 阴影 | 0 4px 24px rgba(139,111,92,0.15) |

---

## 🌐 部署

生产由 `serve.mjs`(3456)反代 `/api/*` 到 `next start`(3457):

```bash
npm run build
npm run serve:api   # 终端 A
npm run serve       # 终端 B
```

- 前端:可部署到 Vercel / 腾讯云 / 任意 Node 主机
- 支付:预留接口(无需自有商户号,匿名结账;未来接入微信/支付宝/Stripe)
- 域名:namesilo / 腾讯云(.com);国内访问需备案 + HTTPS

> ⚠️ 微信内 H5 打开需完成域名备案;建议先海外/香港服务器验证,备案后再切换。

---

Adam,骨架 + 核心 + 商业化全部就位。打开 Cursor 接着干吧!🚀
