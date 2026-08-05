# 朋友匹配页雷达对比优化（2026-07-31 19:56）

## Adam 反馈
朋友匹配页面六位图匹配逻辑和 UI 有点问题

## 根因
Adam 没测过完整流程，看到的是**自己给自己发链接**的调试场景：
- inviter='暗流'，my='暗流'
- shareA=shareB='暗流'
- 两个 polygon 完全重合 → 视觉上只看到一个
- 两个图例文字都是「暗流」→ 看不出"哪个是我"

## 修复

### 1. 图例语义化（FriendView.tsx）

```tsx
// 之前：shareA.name | shareB.name（重名时无法区分）
// 现在：根据 shareA 是不是 inviter 区分
<span className="text-amber-700">
  {shareA === inviterType ? `${shareA.name}（朋友）` : `${shareA.name}（你）`}
</span>
<span className="text-amber-500">
  {shareA === inviterType ? `${shareB.name}（你）` : `${shareB.name}（朋友）`}
</span>
```

### 2. 雷达图颜色高对比（ComparisonRadarChart.tsx）

**之前**：主方 amber-700 + 对比方 amber-500（颜色相近，区分度差）
**现在**：
- 主方（你/朋友）：amber `#B4783C` 实线 + 圆点 r=3
- 对比方（你/朋友）：teal `#5A9994` 虚线 + 圆点 r=2.5
- **色相对比**（暖橙 vs 冷青），不再是相近的暖色对

### 3. 顶点圆点

对比方之前**没渲染圆点**（只看 polygon 边）—— 现在两者都画圆点，进一步区分。

## 构建状态

- ✅ build 4.3s, TS 8.5s, 11/11 路由静态
- ✅ 3456 UP, /friend?inv=暗流 200

## 调整前后

| 元素 | 之前 | 现在 |
|---|---|---|
| 主方填充 | amber rgba(180,120,60,0.25) | rgba(180,120,60,0.32) ↑ |
| 主方描边 | #B4783C w=2 | #B4783C w=2.2 ↑ |
| 主方顶点 | r=2.2 | r=3 ↑ |
| 对比方填充 | amber rgba(217,164,100,0.18) | **teal rgba(125,185,182,0.18)** |
| 对比方描边 | #D9A464 虚线 | **#5A9994** 虚线 |
| 对比方顶点 | （无） | r=2.5 teal #5A9994 |
| 图例 | shareA.name / shareB.name | 「暗流（朋友）」「暗流（你）」|

## Adam 下一步

测试完整流程（测一个其他人格）：
1. 在 result 页点分享 → 拿自己人格的邀请链接
2. 隐身窗口打开（清 localStorage）→ 测试出**另一个**人格
3. 回到原始窗口打开自己发的链接 → 看真实"两个不同人格"的雷达对比

完整流程链接（局域网）：
- `/friend?inv=暗流`（Adam 自己邀请自己的调试态）
- `/friend`（清 localStorage 后的首测态）