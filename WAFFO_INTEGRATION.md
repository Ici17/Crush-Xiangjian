# Waffo 支付接入文档

## 概述

**Waffo Pancake** = 支付网关，收单方（微信/支付宝/银行卡）由 Waffo 对接。
本项目使用 **Waffo 托管收银台**（Hosted Checkout），用户点击支付后跳转 Waffo 页面完成付款。

---

## 接入步骤（5 步）

### Step 1：获取 Private Key

1. 登录 Waffo 后台（docs.waffo.ai）
2. 进入 **设置 → API 密钥**
3. 生成一对 RSA 密钥（平台支持自动生成）
4. **复制 Private Key**（PEM 格式）

> ⚠️ Private Key 仅在后端使用，绝不暴露到前端！

### Step 2：在 .env.local 中填入私钥

```
WAFFO_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----
你的私钥内容（不要换行）
-----END RSA PRIVATE KEY-----
```

### Step 3：在 Waffo 后台创建 3 个产品

登录 Waffo 后台 → **产品 → 创建产品**：

| 产品名称 | 类型 | 价格 | 货币 | Tax Category |
|---|---|---|---|---|
| 完整版-裂变价 | One-time | ¥6.6 | CNY | digital_goods |
| 完整版 | One-time | ¥9.9 | CNY | digital_goods |
| 香气订阅盒 | Subscription | ¥59.9/月 | CNY | digital_goods |

> Subscription 暂时不显示在付费墙（level=4 未对接），可以先只建两个 One-time 产品。

创建后得到产品 ID（`PROD_xxx`）。

### Step 4：在 .env.local 中填入产品 ID

```
NEXT_PUBLIC_WAFFO_PRODUCT_DISCOUNTED=PROD_xxx  ← 裂变优惠价（¥6.6）
NEXT_PUBLIC_WAFFO_PRODUCT_FULL=PROD_xxx         ← 完整版（¥9.9）
NEXT_PUBLIC_WAFFO_PRODUCT_SUBSCRIPTION=PROD_xxx ← 订阅盒（¥59.9）
```

### Step 5：启动服务

```bash
# 终端 1：启动 Next.js API 服务（必须，才能处理 /api/checkout 和 /api/order）
npm start

# 终端 2：启动静态文件 + API 代理服务
npm run serve
```

访问 `http://localhost:3456/result?p=暗流` 测试支付流程。

---

## 技术架构

```
用户点击支付
    ↓
PaymentModal → POST /api/checkout { productId }
    ↓
Next.js API Route → Waffo SDK → 创建 Checkout Session
    ↓
返回 checkoutUrl → window.location.href 跳转
    ↓
Waffo 托管收银台（微信/支付宝/银行卡）
    ↓
支付完成 → 自动跳转回 /result?orderId=ORD_xxx
    ↓
Result Page → POST /api/order { orderId } 验证
    ↓
订单有效 → setPaidLevel(data.paidLevel) → 解锁内容
```

### API 路由

| 端点 | 方法 | 功能 |
|---|---|---|
| `/api/checkout` | POST | 创建 Waffo Checkout Session，返回 `checkoutUrl` |
| `/api/order` | POST | 验证订单状态，返回是否已完成支付 |

### 本地付费档位映射

`order.metadata.orderLevel` 决定解锁级别：

| orderLevel | 解锁内容 |
|---|---|
| `"1"` | 完整版（paidLevel = 2，`paidLevel >= 2` 解锁） |
| `"2"` | 订阅盒（paidLevel = 3） |

> 当前 `unlockDiscounted` 和 `unlockFull` 均可解锁完整版，metadata 都传 `"orderLevel": "1"`。

---

## 本地测试（test 环境）

Merchant ID `MER_6Rd0Agu7N1fIVgagqflrn1` 默认使用 **test 环境**。

test 环境特点：
- 走测试通道，无需真实支付
- 订单状态立即变为 `completed`
- 用于验收支付流程

---

## 生产发布

1. Waffo 后台开启 **Production** 模式
2. Private Key 改为生产私钥
3. 产品 ID 改为生产产品 ID
4. `NEXT_PUBLIC_BASE_URL` 改为真实域名
5. 在 Waffo 后台配置 **Webhook**（接收订单完成事件，用于服务器端验单）

### Webhook 配置（可选但推荐）

Waffo 后台 → Webhooks → 添加端点：

- **URL**: `https://你的域名/api/order-webhook`
- **Events**: `order.completed`
- **Mode**: Production

Webhook 可实现：服务器端自动解锁，无需依赖前端回调。

---

## 当前状态

- ✅ API 路由已就绪（`/api/checkout`、`/api/order`）
- ✅ PaymentModal 已升级为 Waffo 结账流程
- ✅ serve.mjs 已支持 `/api/*` 反向代理
- ⏳ 等待 Waffo 后台 Private Key 和 Product ID
