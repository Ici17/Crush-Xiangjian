# 锁定版底部支付标识对齐解锁版（2026-08-01 01:21）

## Adam 三项反馈

1. 锁定版/解锁版边框「换回 amber-200」
2. 底部图标以**解锁版**为准（饱满 simple-icons 官方 path）
3. 解锁版图标太大了（是说锁定版图标太小——Adam 口误），解错版的图标太大

解读：
- **图标太小**：锁定版图标是简化版「两个气泡」+ 11px 文字，无品牌色
- **图标太大**：Adam 实际意思——解错版（解锁版）的图标看起来大（因为用了饱满图标）
- **希望**：两边都用同一套图标（解锁版饱满 simple-icons）

## 修复

### 1. 锁定版底部支付图标换成解锁版同款（app/result/page.tsx line 932-）

| 元素 | 之前（锁定版）| 现在（= 解锁版）|
|---|---|---|
| 微信图标 | 简化「双气泡」SVG | **simple-icons 官方 path**（饱满） |
| 微信文字 | `text-amber-700` 11px | **`#07C160` 14px / fontWeight 500** |
| 支付宝图标 | 「对话气泡」+ 三条横线 | **simple-icons 官方 path**（饱满） |
| 支付宝文字 | `text-amber-700` 11px | **`#1677FF` 14px / fontWeight 500** |
| 分隔符 | `h-3 w-px bg-amber-200` | **`mx-4 h-4 w-px bg-amber-300`** |
| 安全提示 icon | `inline-block mr-1` | **`inline-flex gap-1`** |

### 2. 边框换回 amber-200（两版订阅盒 article）

| 文件 | 之前 | 现在 |
|---|---|---|
| `app/result/page.tsx`（锁定版订阅盒）| 内联 `border: 1px solid #F0D8B6`（深）| **class `border border-amber-200` + 删内联边框** |
| `components/UnlockedContent.tsx`（解锁版订阅盒）| 内联 `border: 1px solid #F0D8B6`（深）| **class `border border-amber-200` + 删内联边框** |

两版订阅盒卡片视觉一致：cream #FAF3EA 背景 + amber-200 边框。

### 3. 解锁版补回衬线尾句（components/UnlockedContent.tsx）

**之前解锁版没有这句**，只有锁定版有。Adam 要求「解锁版也抄上」：

```tsx
<p
  className="text-amber-700/80 mt-3 leading-6 text-center"
  style={{ fontSize: '12px', fontFamily: '"Noto Serif SC", serif' }}
>
  一份关于你的香气答案，值得被认真看见。
</p>
```

两版现在都用同样的衬线尾句（Noto Serif SC，12px，amber-700/80）。

## 附带修复：TypeScript 类型 bug

### 4. `lib/matchPerfumes.ts` ScentVector 加 string index

`ScentVector` interface 加 `[key: string]: number`，避免它不能传给 `{[k: string]: number}` 类型。

### 5. `lib/personalities.ts:605` cosineDistance 签名放宽

```ts
// 之前：
function cosineDistance(a: Record<RadarDim, number>, b: Record<RadarDim, number>): number {
// 现在：
function cosineDistance(a: { [k: string]: number }, b: { [k: string]: number }): number {
```

允许 `Record<RadarDim, number>`（中文 key）+ `ScentVector`（英文 key）互换。

### 6. `lib/branchingQuestions.ts:6` import 来源修正

之前：`import { PERSONALITY_TYPES, type ScentVector } from "./data";`（data 没有 ScentVector）
现在：`import { PERSONALITY_TYPES } from "./data"; { cosineSimilarity, type ScentVector } from "./matchPerfumes";`

### 7. 清理根目录调试脚本

删除：
- `verify-budget-diversity.ts`
- `verify-global-dedup.ts`
- `review-fixed-match.ts`

（之前轮次残留，会被 Next.js TS check 扫描到导致编译失败）

## 构建状态

- ✅ build 4.5s, TS 8.4s
- ✅ 11/11 路由静态
- ✅ 3456 UP, /result / /result?previewPaid=1 /preview 200

## Adam 下一步

刷新对比两个版本：

| 链接 | 显示 |
|---|---|
| http://192.168.10.15:3456/result | **锁定版**：饱满图标 + 品牌色 + 边框 amber-200 |
| http://192.168.10.15:3456/result?previewPaid=1 | **解锁版**：饱满图标 + 品牌色 + 边框 amber-200 + 新增衬线尾句 |

两版底部视觉一致（卡片、图标、文字、边框、衬线尾句全部对齐）。