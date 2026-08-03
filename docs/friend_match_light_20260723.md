# 朋友匹配 · 轻量版实现（2026-07-23）

## 决策（已拍板）
- **技术路径**：轻量版 — URL 带邀请者人格，朋友测完本地算，零后端、零登录
- **好友认定**：靠分享链接行为 — 通过我专属链接进来的人 = 我邀的朋友（微信无好友关系 API，技术上不可判断）

## 核心逻辑链路
1. 我测完 → result 页点「生成邀请链接」→ 生成 `/friend?inv=<我的personalityId>`
2. 我转发到微信聊天/朋友圈
3. 朋友点链接 → 进 `/friend?inv=<id>`
4. 朋友若有本地测试结果（localStorage）→ 自动用 `calculateCompatibility(inviter, friend)` 出匹配
5. 朋友若没测过 → 引导去 `/question?inv=<id>`，测完自动回跳 `/friend?inv=<id>` 出匹配
6. **识别对方 ID** = URL 参数 `inv`（人格 id，前端从内置 `PERSONALITY_TYPES` 取完整数据，无需后端）
7. **好友认定** = 通过专属链接进来（行为代理），不依赖微信关系链

## 改动文件
- `lib/invite.ts`（新建）：`getMyPersonalityId` / `getInviterIdFromUrl` / `buildInviteLink` / `copyToClipboard`
- `app/question/page.tsx`：finish & skip 检测 `?inv`，测完跳 `/friend?inv=<id>` 而非 `/result`
- `app/friend/page.tsx`（重构为朋友视角）：读 inv 设邀请者、读自己 localStorage 结果、自动匹配、无结果引导测试、保留无邀请时的手动双选
- `app/result/page.tsx`：加「生成邀请链接，发给朋友」裂变钩子卡片（handleInvite）

## 链接格式
`https://<domain>/friend?inv=<personalityId>`（如 `?inv=anliu`）

## 微信分享（两层）
- **零后端（已实现可用）**：微信内点右上角「···」转发，当前页 URL 自带 `?inv` 参数，朋友点开即带参。无需任何服务端。
- **美化（下一步，需后端）**：JS-SDK 自定义分享卡片（标题/缩略图/链接），需 `/api/wechat-signature` 签名端点（appId + secret 服务端，需认证服务号）。非必须。

## 验证
- `npm run build` 通过（13.5s）
- 真机测试：手机微信打开 result 页 → 生成链接 → 发朋友 → 朋友点 → 测 → 看匹配

## 已知边界
- 朋友必须也完成测试才能出真匹配（否则引导测试）
- 不做防作弊 / 匹配记录（轻量版无后端）；如需数据统计再做 `matches` 表
