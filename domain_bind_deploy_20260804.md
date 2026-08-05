# 域名绑定 + 环境变量 + 部署（2026-08-04）

## 已完成
1. **Vercel 加域名** `crushxiangjian.com`（API：`verified=True`）
2. **环境变量** `NEXT_PUBLIC_BASE_URL` → `https://crushxiangjian.com`（Vercel 自动加密）
3. **本地 .env.local** 同步更新
4. **直接部署**（Vercel CLI，绕过被拦的 GitHub push）：含 5 个 budget 香水 tier 修复
   - 部署输出：`Ready in 48s` / `Aliased https://crushxiangjian.com`
   - SSL 证书异步生成中

## 待 Adam 操作（沙箱无法代劳）
### A. DNS 配置（域名注册商后台）
Vercel 标记 verified=True，但本地 DNS 端口被沙箱屏蔽无法确认。若访问 `crushxiangjian.com` 仍超时/无法解析，需在注册商加记录：

**方案 1（推荐）：用 Vercel DNS**
- 把域名 nameserver 改为：`ns1.vercel-dns.com` / `ns2.vercel-dns.com`

**方案 2：A 记录**
- `crushxiangjian.com` → `76.76.21.21`（A 记录，TTL 600）

### B. Waffo 支付密钥（仍占位符，支付会失败）
- `.env.local` 的 `WAFFO_PRIVATE_KEY` 仍是模板
- 3 个 `NEXT_PUBLIC_WAFFO_PRODUCT_*` 仍是 `PROD_xxx`
- 需 Vercel Dashboard → Environment Variables 补齐 + 重新部署

### C. ICP 备案（国内访问/微信分享必需）
- 域名解析到 Vercel 海外节点，微信会拦
- 需国内服务器 + ICP 备案（7-20 天）

## 验证方式（Adam 侧）
- 浏览器打开 `https://crushxiangjian.com`
- 测试「裂岸」人格结果页 → 尝试香应显示「沉香迷雾」(¥130-280) 而非 Kilian 旷野之心
