# 测试页三处 Bug 修复（2026-07-31 06:00）

## 用户反馈

测试页（`/question`）截图显示三处异常：
1. 进度条 **9 / 7** — 超过题数上限
2. 副标显示 **"窗台边"**（分支子题 scenario fallback）— 不是设计预期的"关于边界/距离..."
3. 路径胶囊出现 8 个 + 重复（"海边灯塔"出现 2 次）

## 根因

| Bug | 根因 |
|---|---|
| 进度条 9/7 | `branchStep = choices.length + 1`，但子分支 q5e/q6abc 等层数干扰了 choices 长度；分母 `TOTAL_BRANCH=7` 写死不变 |
| 副标 fallback | `SCENARIO_LABEL` 用顶层 scenario 名映射（"深夜的邀请"等），但 `currentQ.scenario` 拿到的是子分支的（"窗台边"），dict miss → 原始字符串兜底 |
| 胶囊重复 | 用户"上一题"回退后再选同 choice → `progress.choices` push 了同一 id（虽然 ID 不同但 pathLabel 相同，因为分支 q3/q6 可能 share 同主题） |

## 修复

**`app/question/page.tsx`**

### 1. 进度计算改为顶层 q 推断
```ts
function getTopLevelFromChoices(choices: string[]): number {
  const last = choices[choices.length - 1];
  if (!last) return 0;
  const match = last.match(/^q([1-7])/);
  return match ? parseInt(match[1], 10) : 0;
}
const branchTopLevel = getTopLevelFromChoices(progress.choices);
const branchStep = isCalibration
  ? TOTAL_BRANCH
  : Math.min(branchTopLevel + 1, TOTAL_BRANCH);
```

走 q1aa → branchTopLevel=1 → branchStep=2 ✓
走 q5b → branchTopLevel=5 → branchStep=6 ✓
走 q7 之后（calibration）→ branchStep=7（始终定格在 7）

### 2. 副标改为 q-id 顶层映射
```ts
const Q_TOP_LABEL: Record<string, string> = {
  q1: "关于温度", q2: "关于距离", q3: "关于夜",
  q4: "关于留白", q5: "关于回忆", q6: "关于边界", q7: "关于野心",
  // q5a–q5i 都映射"香气记忆"
};
const topLevelKey = progress.currentQuestionId.match(/^q[1-7]/)?.[0];
const scenarioLabel = (topLevelKey && Q_TOP_LABEL[topLevelKey])
  || (progress.phase === "calibration" ? "香气校准" : "")
  || "";
```

不管子分支走到 q3ba/q4cb/q5e... 都按顶层 q1-q7 算副标。

### 3. 路径胶囊去重
```ts
const displayPathLabels = (() => {
  const raw = getPathLabels(displayChoices);
  const seen = new Set<string>();
  const deduped: typeof raw = [];
  for (const item of raw) {
    const key = `${item.emoji}|${item.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped;
})();
```

回退重选造成的同 label 胶囊只显示一次。

### 4. navigate 转场文案键也用顶层 q
```ts
const topOfNext = nextQuestionId.match(/^q([1-7])/);
const topLevel = topOfNext ? parseInt(topOfNext[1], 10) : 0;
const nextStep = phase === "calibration"
  ? 7 + newCal.length + 1
  : Math.min(topLevel + 1, 7);
```

顺手修，避免 TRANSITION_COPY 索引超出。

### 5. TS 报错清理
旧变量 `totalSteps` → 改为常量 `TOTAL_STEPS`（同步修 isLastCal 比较）。

## 验证

- `npm run build` 0 错误，11/11 路由静态生成
- `/question` HTTP 200，len=15679
- 客户端渲染后进度条/副标/胶囊需浏览器复测（已通过 headless 浏览器能力被 SSRF 拦截，需 Adam 在手机/浏览器实跑）

## 已知遗留

- "上一题"回退再选导致 `progress.choices.length` 仍按累计走，**显示分支步骤不会少**（因为是 1→2→3 计数）。
  - 例：用户答 q1→q2→q3，回退到 q2 重选同 pathLabel → choices.length=2 → 显示 3/7
  - 这其实是正确行为（已答 2 题进入第 3 题），不算 bug
- 真正"残影"问题（重复胶囊）由 dedupe 解决
