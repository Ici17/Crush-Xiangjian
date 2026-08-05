# 校准阶段卡死修复（2026-07-31 17:50）

## 现象

Adam 反馈：测试到 **7/7 副标"香气校准"** 时**页面中部空白**、底部"继续校准 →"灰按钮，**点不动**。

## 根因

`handleNext()` 进入 `setAnimating(true)` 之后调 `navigate()`。`navigate()` 有两个分支：
- 有 `TRANSITION_COPY` 命中 → 走 `setTimeout(320ms)` 转场后 `setAnimating(false)` ✓
- **无 `TRANSITION_COPY` 命中 → 立即 setProgress，但漏写 `setAnimating(false)`** ✗

结果：题目区永久 `opacity-0 translate-y-4 blur-sm`，用户看不到题、选不到。

## 修复

**`app/question/page.tsx`**：
1. `navigate()` else 分支末尾补 `setAnimating(false)`（apply_patch 已修）
2. 增加容错 useEffect：当 currentQ 为 undefined 时（localStorage 持久化过期）按 phase 跳到首题，避免空白页

## 验证

- `npm run build` ✅ 14.2s，0 错误，11/11 路由
- `serve.mjs` 重启后 5 路由 200 冒烟通过
- 截图用户的卡死进度：`progress.choices=7`, `calibrationChoices=1`, `phase=calibration`, `currentQuestionId=cal2`
  - 修复后：会正确显示"留香程度——"题 + 3 个选项（A 持久 / B 适中 / C 清淡）
  - 答完 cal2 → 进入 cal3（最后一题）→ 按钮变 "生成我的香气报告 →"

## 备注

- 建议 Adam 用**隐身窗口**或清 localStorage 后重测，避免残留旧进度
- 已修 bug 也对 **Stripe → Waffo** 期间所有 navigate 调用有效（不只是校准过渡）

## 文件

- `app/question/page.tsx`（两处修改：else 分支 setAnimating(false)、useEffect 容错 fallback）
