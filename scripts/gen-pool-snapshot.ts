// 生成今日香签的「香水库顺序快照」
//
// 背景：lib/daily/draw.ts 原先直接用 Object.keys(PERFUMES) 洗牌，导致
// 往香水库里增删一支香水，所有历史日期的抽签结果都会被重算。
//
// 本脚本导出当前的键顺序并冻结为 lib/daily/pool.ts，之后抽签读快照而非实时库，
// 历史日期的签文即可永久稳定。
//
// 用法：npx tsx scripts/gen-pool-snapshot.ts

import fs from "node:fs";
import path from "node:path";
import { PERFUMES } from "../lib/data";

const keys = Object.keys(PERFUMES);

const lines = keys.map((k) => "  " + JSON.stringify(k) + ",").join("\n");

const out = `// ============================================================
// Crush香鉴 — 今日香签 · 香水库顺序快照（勿手改）
// ============================================================
//
// 由 scripts/gen-pool-snapshot.ts 自动生成。
//
// 为什么需要它：抽签的 Fisher-Yates 洗牌同时依赖数组的「顺序」和「长度」
// 两个变量 —— 不只是重排，往末尾追加一支香水同样会改变 rng 消耗次数，
// 从而把历史上所有日期的结果洗一遍。所以香水库必须按「代（epoch）」冻结。
//
// 规则（重要）：
//   1. 本文件一旦生成即为历史契约，DAILY_POOL_V1 的**顺序和长度都不许再动**；
//   2. 需要扩库时，新开一支快照 DAILY_POOL_V2（含全量旧顺序 + 新香），
//      然后在 lib/daily/draw.ts 的 POOL_EPOCHS 中登记生效日期；
//      历史日期继续用旧代，结果永不变，新代只影响生效日之后；
//   3. 切勿删除或修改已有条目，否则该代所有历史日期的结果都会错乱。

export const DAILY_POOL_V1: readonly string[] = [
${lines}
];

// 扩库时在此新增 DAILY_POOL_V2 / V3 ...，并在 lib/daily/draw.ts 的 POOL_EPOCHS
// 中登记它从哪一天起生效。
`;

const target = path.join(process.cwd(), "lib", "daily", "pool.ts");
fs.writeFileSync(target, out, "utf8");

console.log(`已写入 ${target}`);
console.log(`香水总数：${keys.length}`);
console.log(`前 5 支：${keys.slice(0, 5).join(" / ")}`);
console.log(`后 3 支：${keys.slice(-3).join(" / ")}`);
