# 微信内好友分享闭环（2026-07-31 18:26）

## Adam 确认的精确流程

好友收到链接后：
- **聊天卡片预览**：看到朋友的结果（静态 meta tag）
- **一旦点进链接**：无论测没测过 → 都进自己的阵营（/question 或 /result）
- **再也看不到朋友的结果页**（除非在聊天卡片里）
- 重新打开同一链接 → 仍是自己的结果
- 想看朋友的结果 → 不可能（除非在聊天卡片里看）

## 实现

### `app/shared/page.tsx`（纯路由层，无 UI）

```ts
// 核心路由逻辑：任何人点进来都进自己的阵营
useEffect(() => {
  if (skip === '1') return; // 调试模式：显示 SharedView

  const pid = localStorage.getItem('crushxiangjian_personality_id');
  if (pid) {
    router.replace('/result'); // 已测过 → 去自己的结果
  } else {
    router.replace(`/question${inv}`); // 首次 → 进自己的测试页
  }
}, [personalityName, skip, router]);
```

- 设置 meta title（`<title>` 标签）供微信卡片预览
- `?skip=1` 保留：调试时可见完整 SharedView

### `app/shared/SharedView.tsx`

- 接收 `debugMode?: boolean` prop
- `debugMode=false`（默认）→ 所有用户看到空白 loading
- `debugMode=true`（`?skip=1`）→ 显示完整分享卡（用于 html2canvas 截图）

### 静态 meta tag（微信分享卡片预览）

| URL | 卡片显示 |
|---|---|
| `/shared?p=暗流` | 「暗流的香气人格 \| Crush香鉴」|
| `/shared?p=荒岛` | 「荒岛的香气人格 \| Crush香鉴」|

（微信实际预览需要 og:title/description + 已认证服务号，当前先用 `<title>`）

## 完整好友体验流程

```
【A 发链接】
测试完 → /result → 点分享 → 调起微信 → 转发 /shared?p=暗流

【B 首次点链接】
/shared?p=暗流
  → meta title: 「暗流的香气人格 | Crush香鉴」（聊天卡片预览）
  → B 点进去 → router.replace('/question')
  → B 答题 → /result（自己的人格）
  → B 分享自己的 /shared?p=X

【B 再点 A 的链接】
/shared?p=暗流 → router.replace('/result')（B 的结果）
  → 永远看不到 A 的暗流结果

【A 自己点自己的链接】
/shared?p=暗流 → A 的 pid='暗流' → router.replace('/result')
  → A 看到自己的暗流结果
```

## 验证

- 构建 ✅ 8.0s，0 错误，0 警告
- 路由 200：/` `/question` `/result` `/preview` `/shared?p=暗流`
- serve.mjs 已重启

## 文件改动

- `app/shared/page.tsx` —— 完全重写为路由层（+ meta title + 路由逻辑）
- `app/shared/SharedView.tsx` —— 加 `debugMode?: boolean` prop + 非调试模式返回空白
- `compare-fixed-vs-algo.ts` —— 删（不在构建路径，但含 ScentVector 错误引用）