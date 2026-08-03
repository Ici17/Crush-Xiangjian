# Crush 香鉴 — Vercel 部署指南

## 仓库信息
- **GitHub**: https://github.com/Ici17/Crush-Xiangjian
- **分支**: main

---

## 第一步：Vercel 导入项目

1. 打开 [vercel.com](https://vercel.com)，用 GitHub 账号登录
2. 点击 **Add New → Project**
3. 在 "Import Git Repository" 列表中找到 **Crush-Xiangjian**，点击 **Import**
4. Framework Preset 自动识别为 **Next.js**，无需修改

---

## 第二步：配置环境变量

在 Vercel 项目配置页，找到 **Environment Variables**，添加以下 5 个变量：

| Name | Value | Notes |
|------|-------|-------|
| `WAFFO_PRIVATE_KEY` | `-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----` | 从 Waffo 后台获取，保留换行符 `\n` |
| `NEXT_PUBLIC_WAFFO_PRODUCT_DISCOUNTED` | `PROD_xxx` | 裂变优惠档（¥6.6），Waffo 后台创建产品后填入 |
| `NEXT_PUBLIC_WAFFO_PRODUCT_FULL` | `PROD_xxx` | 完整版（¥9.9） |
| `NEXT_PUBLIC_WAFFO_PRODUCT_SUBSCRIPTION` | `PROD_xxx` | 订阅盒（¥59.9） |
| `NEXT_PUBLIC_BASE_URL` | `https://your-domain.vercel.app` | 部署成功后再填（见第四步） |

> ⚠️ `WAFFO_PRIVATE_KEY` 是后端变量，不会暴露给浏览器。
> ⚠️ 3 个 `PROD_xxx` 是产品 ID，公开无害，但留占位符时支付按钮会报错。

---

## 第三步：部署

1. 点击 **Deploy**
2. 等待 2-3 分钟（Build + Deploy）
3. 部署成功后会得到一个 `.vercel.app` 子域名，例如：
   `https://crush-xiangjian.vercel.app`

---

## 第四步：更新 BASE_URL

Vercel 给你真实域名后，回到 Environment Variables：

1. 把 `NEXT_PUBLIC_BASE_URL` 的值改为：
   `https://crush-xiangjian.vercel.app`（替换成你的真实地址）
2. 触发 **Redeploy**（点项目页右上角三个点 → Redeploy）

---

## 第五步：自定义域名（可选）

1. Vercel 项目 → **Settings → Domains**
2. 填入你的域名（如 `xiangjian.com`）
3. 在域名服务商（腾讯云/DNSPod）添加 DNS 记录：
   - CNAME: `cname.vercel-dns.com`
4. 等 DNS 生效（5 分钟~24 小时），Vercel 自动颁发 SSL 证书

---

## Vercel 环境变量快速参考

```
WAFFO_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyf8Qj6...
...（完整 PEM 内容，换行处保留 \n）
-----END RSA PRIVATE KEY-----

NEXT_PUBLIC_WAFFO_PRODUCT_DISCOUNTED=PROD_xxxxxxxxxxxx
NEXT_PUBLIC_WAFFO_PRODUCT_FULL=PROD_yyyyyyyyyyyy
NEXT_PUBLIC_WAFFO_PRODUCT_SUBSCRIPTION=PROD_zzzzzzzzzzzz
NEXT_PUBLIC_BASE_URL=https://crush-xiangjian.vercel.app
```

---

## 本地开发

```bash
# 克隆仓库
git clone https://github.com/Ici17/Crush-Xiangjian.git
cd Crush-Xiangjian

# 安装依赖
npm install

# 复制环境变量（本地开发需填入真实密钥）
cp .env.local.example .env.local
# 编辑 .env.local 填入真实值

# 启动
npm run dev
```

---

## 本次部署已知限制

1. **Waffo 支付**：密钥和 3 个产品 ID 仍为占位符，支付功能暂不可用；UI 和弹窗流程已就绪
2. **OG Image**（`/api/og`）：使用 Next.js Edge Runtime，在 Vercel 部署可正常工作；本地 `next start` 无法使用
3. **微信 JS-SDK 分享**：需认证微信服务号，v2 再接入

---

## 构建状态

- ✅ TypeScript 编译通过
- ✅ 9 个路由（/ /question /result /result?previewPaid /friend /preview /shared /api/checkout /api/order /api/og）
- ⚠️ 支付功能需 Waffo 真实密钥
