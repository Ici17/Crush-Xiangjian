# Crush 香鉴 — 开发文档

> 你的灵魂，藏在哪种香气里？
> 10道情境题 × 16种人格 × 110款本命香水

---

## 🏗 当前进度

### ✅ 已完成（骨架 + 核心逻辑）
- [x] Next.js 15 + TypeScript + Tailwind CSS v4 项目初始化
- [x] 16种人格类型完整数据（含名字、香调向量、香水推荐、性格报告）
- [x] 110款香水数据库（中英品牌名、三调香料、扩散力/留香评级）
- [x] 10道情境向量问卷（6维向量采集）
- [x] 匹配算法（余弦相似度）
- [x] 落地页（首页）
- [x] 问卷页（答题 + 进度保存 localStorage）
- [x] 结果页（人格卡片 + 雷达图 + 香水卡 + 付费墙）
- [x] PWA manifest
- [x] Supabase 数据层代码（等待配置密钥）
- [x] 微信支付占位接口

### 🔲 待开发
- [ ] 服务进程（`public/sw.js`）— PWA离线缓存
- [ ] 微信支付 JSAPI 真实接入（需后端生成预支付订单）
- [ ] Supabase 项目创建 + 表结构 + RLS 配置
- [ ] `.env.local` 配置（Supabase URL + ANON_KEY）
- [ ] 雷达图改用 Recharts（当前是 div 模拟）
- [ ] 朋友匹配功能
- [ ] 分享图生成（html2canvas）
- [ ] Vercel / 腾讯云部署
- [ ] 域名备案 + HTTPS
- [ ] 微信公众平台配置（网页授权域名）
- [ ] 微信商户号申请 + 支付配置

---

## 🚀 快速开始

```bash
# 1. 进入项目目录
cd crushxiangjian

# 2. 启动开发服务器
npm run dev

# 3. 打开浏览器
# http://localhost:3000
```

## 🔧 配置环境变量

创建 `.env.local`：

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...（Supabase anon key）
```

---

## 📂 项目结构

```
crushxiangjian/
├── app/
│   ├── layout.tsx          # 根布局（PWA meta + 字体）
│   ├── globals.css         # 品牌色彩 + Tailwind v4 主题
│   ├── page.tsx            # 落地页
│   ├── question/
│   │   └── page.tsx        # 问卷页
│   └── result/
│       └── page.tsx        # 结果页
├── lib/
│   ├── data.ts             # 16人格 + 110香水 + 问卷 + 匹配算法
│   └── supabase.ts         # 数据层（保存会话、行为追踪）
├── public/
│   ├── manifest.json       # PWA manifest
│   └── icons/              # 图标（需补充）
└── package.json
```

---

## 💡 交给 AI 继续开发

将以下内容复制给 Cursor / Claude Code：

```
请继续开发 crushxiangjian 项目，优先级：

P1（必须）
1. 创建 public/sw.js 服务进程，支持离线访问
2. 雷达图改用 Recharts 组件渲染（src/components/RadarChart.tsx）
3. 创建微信支付接入文件 src/lib/wechatPay.ts（微信 JSAPI 支付）
4. 完成朋友匹配功能（输入朋友名字生成对比报告）

P2（重要）
5. 实现分享图生成（html2canvas 截图）
6. 完成 Supabase 表创建脚本 docs/supabase_schema.sql
7. 创建 docs/DEPLOY.md 部署文档（Vercel + Supabase）

P3（增强）
8. 添加微交互动效（framer-motion）
9. 添加更多人格类型测试用例
10. SEO 优化（Open Graph 标签 + sitemap）
```

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

## 📱 PWA 图标

需要补充以下文件到 `public/icons/`：
- `icon-192.png`（192×192）
- `icon-512.png`（512×512）

建议设计：琥珀色渐变背景 + "香" 字或抽象玫瑰图形

---

## 🌐 域名 & 部署

推荐方案：
- **前端**：Vercel（Next.js 原生支持，免费）
- **数据库**：Supabase（免费层够用）
- **支付**：微信商户号 + 微信 H5 支付
- **域名**：namesilo / 腾讯云（.com ¥60/年）

> ⚠️ 注意：微信内打开的 H5 页面必须完成域名备案。
> 建议先用香港/海外服务器快速验证，备案完成后再切换。

---

Adam，骨架已经全搭好了。打开 Cursor 接着干吧！🚀
