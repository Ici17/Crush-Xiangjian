// 香水库「可达性」诊断
//
// 核心问题：225 支香水里，究竟有多少支在任何用户路径下都永远推不到？
// 平价档由 27 个校准方向各锁 1 支（budget 池 47），高端档每画像取前 2 —
// 若可达数远小于库存数，说明大量香数据是死库存。
//
// 做法：枚举「16 人格 × 27 种校准方向」共 432 组真实用户组合，
// 再叠加 canonical 视图（16 原型各自锁支），收集所有出现过的香水。
//
// 用法：npx tsx scripts/audit-perfume-reachability.ts

import { PERFUMES, PERSONALITY_TYPES } from "../lib/data";
import { getCalibratedRecommendations } from "../lib/matchPerfumes";

const ALL_CAL: string[][] = [];
for (const c1 of ["cal1a", "cal1b", "cal1c"]) {
  for (const c2 of ["cal2a", "cal2b", "cal2c"]) {
    for (const c3 of ["cal3a", "cal3b", "cal3c"]) {
      ALL_CAL.push([c1, c2, c3]);
    }
  }
}

const allPerfumes = Object.values(PERFUMES) as { name: string; tier?: string }[];
const premiumCount = allPerfumes.filter((p) => p.tier === "premium").length;
const budgetCount = allPerfumes.filter((p) => p.tier === "budget").length;

const seenReal = new Map<string, number>();
const seenCanon = new Map<string, number>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
for (const arch of PERSONALITY_TYPES as any[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const radar = arch.radarScores as any;
  for (const cal of ALL_CAL) {
    for (const rec of getCalibratedRecommendations(radar, cal, [], arch.id, false)) {
      seenReal.set(rec.name, (seenReal.get(rec.name) ?? 0) + 1);
    }
    for (const rec of getCalibratedRecommendations(radar, cal, [], arch.id, true)) {
      seenCanon.set(rec.name, (seenCanon.get(rec.name) ?? 0) + 1);
    }
  }
}

const reachable = new Set<string>([...seenReal.keys(), ...seenCanon.keys()]);
const dead = allPerfumes.filter((p) => !reachable.has(p.name));

const ratio = ((reachable.size / allPerfumes.length) * 100).toFixed(1);
const deadPremium = dead.filter((p) => p.tier === "premium").length;
const deadBudget = dead.filter((p) => p.tier === "budget").length;

console.log("══════ 香水库可达性诊断 ══════");
console.log(`香水库总数：${allPerfumes.length}（premium ${premiumCount} / budget ${budgetCount}）`);
console.log(`枚举用户组合：${(PERSONALITY_TYPES as unknown[]).length} 人格 × ${ALL_CAL.length} 校准方向 = ${(PERSONALITY_TYPES as unknown[]).length * ALL_CAL.length} 组 × 2 种视图`);
console.log("");
console.log(`可达香水：${reachable.size} 支（占比 ${ratio}%）`);
console.log(`  · 真实用户路径出现：${seenReal.size} 支`);
console.log(`  · canonical 视图出现：${seenCanon.size} 支`);
console.log(`永不可达（死数据）：${dead.length} 支`);
console.log(`  · premium ${deadPremium} / budget ${deadBudget}`);
console.log("");

const sortedReal = [...seenReal.entries()].sort((a, b) => b[1] - a[1]);
console.log("出现频次 TOP 10（是否过度集中）：");
for (const [name, n] of sortedReal.slice(0, 10)) {
  console.log(`  ${name} — ${n} 次`);
}
console.log("");

console.log(`死数据名单（前 40 / 共 ${dead.length}）：`);
for (const p of dead.slice(0, 40)) {
  console.log(`  [${p.tier}] ${p.name}`);
}
if (dead.length > 40) console.log(`  ……另有 ${dead.length - 40} 支`);
console.log("");

// ── 回归校验：canonical 视图下 16 个原型的「尝试香」必须互不重复 ──
// （这是 buildArchetypeBudgetAssignment 存在的初衷，改动去重逻辑后必须复核）
const canonBudget = new Map<string, string>();
let canonDup = 0;
for (const arch of PERSONALITY_TYPES as any[]) {
  const radar = arch.radarScores;
  // canonical 视图固定使用中性校准，取第一位即可代表该原型的锁定结果
  const recs = getCalibratedRecommendations(radar, ["cal1b", "cal2b", "cal3b"], [], arch.id, true);
  const budgetRec = recs.find((r) => r.role === "budget");
  if (!budgetRec) continue;
  const prev = canonBudget.get(budgetRec.name);
  if (prev && prev !== arch.id) {
    canonDup++;
    console.log(`  重复！${budgetRec.name} 同时分配给 ${prev} 与 ${arch.id}`);
  }
  canonBudget.set(budgetRec.name, arch.id);
}
console.log(`canonical 视图 16 原型分配的尝试香：${canonBudget.size} 支`);
console.log(`重复冲突数：${canonDup}（应为 0）`);

console.log("");
console.log(
  reachable.size / allPerfumes.length < 0.5
    ? "结论：过半香水库为死库存，建议修复推荐池"
    : `结论：可达率 ${ratio}%（剩余死库存集中在 premium 长尾，由「以香搜人 / 香柜」等浏览型功能消化）`
);
