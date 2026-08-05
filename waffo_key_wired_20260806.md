# Waffo 私钥接入（2026-08-06）

## 进展
Adam 提供了 Waffo RSA 私钥（PEM，pkcs1，2048-bit）。已完成接入：

1. **本地校验**：`crypto.createPrivateKey` 解析通过，确认是合法 RSA 私钥。
2. **写入 `.env.local`**：以单行带引号 + `\n` 转义格式写入（Next.js `@next/env` 解析验证 `VALID=true`，PEM 头尾完整、含真实换行）。
3. **写入 Vercel 生产环境变量**：`POST /v10/projects/prj_mMpn1pCVlIVyXg87JCqeZNf5yzwT/env` 返回 201，`WAFFO_PRIVATE_KEY` 以 `encrypted` 类型存储（生产环境，已确认 stored=yes）。
4. **清理**：临时密钥文件（含明文私钥）已从 temp 删除，不落盘。

## 待办（阻塞支付链路）
仍缺 **3 个 Waffo 产品 ID**，Adam 需从 Waffo 后台「产品 → 创建产品」获取并贴给我：

| 填到变量 | 产品名 | 类型 | 价格 | 币种 | 类目 |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_WAFFO_PRODUCT_DISCOUNTED` | 完整版-裂变价 | One-time | ¥6.6 | CNY | digital_goods |
| `NEXT_PUBLIC_WAFFO_PRODUCT_FULL` | 完整版 | One-time | ¥9.9 | CNY | digital_goods |
| `NEXT_PUBLIC_WAFFO_PRODUCT_SUBSCRIPTION` | 香气订阅盒 | Subscription | ¥59.9/月 | CNY | digital_goods |

> 注意：merchant ID `MER_6Rd0Agu7N1fIVgagqflrn1` 为 **test 环境**，产品需在对应 test 环境创建，私钥/产品才匹配。订阅盒（level=4）当前代码未接到付费墙，可先建前两个 One-time 跑通支付。

## 收到 3 个 PROD_xxx 后的操作
1. 写进 `.env.local`（3 个变量）
2. 同步进 Vercel 生产环境变量
3. 重新部署 `crushxiangjian.com`
4. 冒烟 `/api/checkout`（POST productId）验证返回 checkoutUrl

## 当前状态
- 私钥：✅ 已落本地 + Vercel 生产
- 产品 ID：⏳ 等 Adam 提供
- 部署：⏸ 暂未触发（避免产品 ID 仍为占位导致支付失败）
