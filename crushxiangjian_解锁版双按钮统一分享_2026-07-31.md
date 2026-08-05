# 解锁版双按钮 + 统一分享流程（2026-07-31 17:58）

## 变更

`app/result/page.tsx`：

1. **底部 CTA 区**：去除「解锁版无朋友 = 单按钮」分支。
   - 解锁态（`paidLevel >= 2`）→ 统一显示**双按钮**：分享 / 契合度
   - 锁定态（`paidLevel < 2`）→ 单按钮：分享

2. **新增 `handleShare`** 函数（line ~244，`personality` 声明之后）：
   - 保存分享图（html2canvas）→ 复制邀请链接 → 调起 navigator.share
   - **统一处理**：锁定版、解锁版都用它
   - 平台差异：
     - 微信内（无 navigator.share）→ toast「分享图已下载 · 链接已复制 ✓」
     - 移动 Chrome/Safari（有 navigator.share）→ 原生面板
     - 用户点 × 取消 → 走 toast 路径

3. **解锁版不再丢失分享图**：之前解锁版 onClick 只传 `shareLink`，没下载图。现在与锁定版一样先 `handleSaveShareImage` → 用户始终拿到「图 + 链接」双产物。

## 验证

- 构建 ✅ 4.8s，0 错误
- serve.mjs 已重启
- 4 路由 200（`/result?p=暗流`、`?previewPaid=1`、带 demo 参数的组合、`/`）

## 共享的分享卡 DOM（无需改）

`#share-card` 是隐藏的固定 JSX（line ~1054），锁定/解锁截图都来自同一段 DOM → **分享卡页面内容自动一致**，需求 #2 自然满足。

## 文件

- `app/result/page.tsx` —— 3 处编辑：删除原 handleShare（l185 位置错）+ 在 personality 后重新插入 + 改写底部 CTA 三分支为两分支