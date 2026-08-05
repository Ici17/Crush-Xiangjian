# 微信内分享闭环重构（2026-07-31 18:09）

## 目标

**去掉「复制链接」步骤**：用户测试完直接通过微信转发 /shared?p=X 链接，好友看到的是对方测试结果；好友想自己测 → 点主 CTA → 进 /question；好友测完自己 → 看自己的 /result；好友再点链接 → 又看到对方结果；只有明确「重新测试」才清空。

## 改动

### 1. 新增 `lib/useMyTestStatus.ts`
- `useMyTestStatus()`：返回 `{ completed, personalityName, inProgress, answeredCount, totalCount }`
- 三个 localStorage key 一起看（PERSONALITY_ID / BRANCH_PROGRESS / RADAR_SCORES）
- 跨标签同步：storage 事件 + focus
- `clearMyTestProgress()`：清人格结果 + 进度（不动 paidLevel / inviteStatus）

### 2. 改 `app/shared/SharedView.tsx`
- ✅ 主 CTA 改为 `<button onClick={handleStartTest}>`（之前是裸 `<Link href="/question">`）
- ✅ 主 CTA 文案**动态**：
  - 未测过 → 「我也来测测我的香气 →」
  - 进行中（已答 X/10）→「继续测试（已答 X/10）→」
  - 已完成 → 「查看我的香气结果 →」
- ✅ handleStartTest 逻辑：
  - 未测过 → 直接 push /question
  - 进行中 → confirm「重新开始 / 接续」→ 选择「重新」则清 progress + push /question
  - 已完成 → push /result（用户应该看到自己的）
- ✅ 新增顶部 status bar（用户有自己的结果且与链接不同人格时）：
  - 「你已经测过你的香气人格：XX」+ 「查看我的 →」按钮
- ✅ 新增「测完看契合度 →」次级 CTA（→ `/friend?inv=<encoded>`）
- ✅ 新增「重新测试」入口（仅 completed 时）：
  - confirm「重新测试将清除当前结果」 → 确认后清 progress + push /question

### 3. 验证
- 构建 ✅ 4.4s，0 错误
- serve.mjs 已重启
- 6 路由 200 冒烟：`/`、`/question`、`/result?p=暗流`、`/preview`、`/friend?inv=暗流`、`/shared?p=暗流`

## 流程对照

### 用户视角（新流程）
```
【发送方 Adam】
1. 完成测试 → /result 显示「暗流」
2. 点底部「分享」→ 调起 navigator.share({ url: '/shared?p=暗流' })
3. 选微信 → 转发给好友

【接收方 Bob（微信内点开）】
1. /shared?p=暗流 打开 → 看到「你的朋友是暗流」+ 暗流完整结果（不读 localStorage ✓）
2. 顶部如有 status bar 提示「你自己是 X」（如果 Bob 已测过）
3. 点「我也来测测我的香气 →」
   - 未测过 → 直接 /question
   - 已测过 → 跳 /result 看自己的
4. 测完 → /result（自己的）→ 分享给 Adam

【Bob 再点 Adam 发的链接】
→ 还是看到 Adam 的「暗流」（静态页，不读 localStorage ✓）
```

## 与旧流程差异

| 旧 | 新 |
|---|---|
| /friend?inv=暗流：先看到「你的朋友是暗流」→ 引导测 → 测完看契合度 | /shared?p=暗流：直接看到对方完整结果（雷达/本命/解读），主 CTA 测自己 |
| 主分享链接是 /friend?inv= | 主分享链接是 /shared?p=（已是结果页底部按钮） |
| 契合度逻辑保留在 /friend | /shared 加「测完看契合度」次级按钮 → /friend?inv= |

## 关键不变量

- `/shared?p=X` 仍**只看 URL，不读 localStorage**——这是设计核心
- 用户的 last-test 通过 localStorage 保留，不会因为点链接被覆盖
- "重新测试"是**唯一**会清 localStorage 的入口，且需要 confirm

## 剩余工作

- `/friend` 页面的内容（契合度 / pending 状态）继续保留，朋友页可作为「深度契合度分析」次级场景
- 接收方微信内可考虑加一个「扫码看朋友结果」便捷入口（生产二维码已存在）

## 文件清单

- `lib/useMyTestStatus.ts`（新建）
- `app/shared/SharedView.tsx`（3 处：主 CTA onClick、顶部 status bar、新增次级 CTA + 重新测试按钮）