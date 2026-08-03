// ============================================================
// Crush香鉴 — 香水向量自检（扩库防呆）
// 运行: npm run check:perfumes
// 作用: 扫全库，标出 notes 未被关键词覆盖的香水（零/弱向量），
//       并列出尚未映射的香料名，提示该往 INGREDIENT_MAP 补什么。
// ============================================================

import { PERFUMES } from "../lib/data";
import { getPerfumeProfile, INGREDIENT_MAP } from "../lib/matchPerfumes";

const DIMENSIONS = ["floral", "woody", "fresh", "oriental", "citrus", "gourmand"] as const;

function totalHits(v: { floral: number; woody: number; fresh: number; oriental: number; citrus: number; gourmand: number }): number {
  return DIMENSIONS.reduce((s, d) => s + v[d], 0);
}

console.log("=== Crush香鉴 · 香水向量自检 ===\n");
console.log(`香水库总数: ${Object.keys(PERFUMES).length}\n`);

const zero: string[] = [];
const weak: string[] = [];
const unmapped = new Set<string>();

for (const p of Object.values(PERFUMES)) {
  const v = getPerfumeProfile(p);
  const hits = totalHits(v);
  if (hits === 0) zero.push(p.name);
  else if (hits <= 1) weak.push(`${p.name}（命中 ${hits}）`);

  const allNotes = [...p.notes.top, ...p.notes.heart, ...p.notes.base];
  for (const note of allNotes) {
    const mapped = Object.keys(INGREDIENT_MAP).some((kw) => note.includes(kw));
    if (!mapped) unmapped.add(note);
  }
}

console.log(`零向量（notes 完全未覆盖，重排会被沉底）: ${zero.length}`);
if (zero.length) console.log("  → " + zero.join("、") + "\n");

console.log(`弱向量（仅命中 1 个关键词，匹配信号很弱）: ${weak.length}`);
if (weak.length) console.log("  → " + weak.join("、") + "\n");

console.log(`尚未映射的香料名（建议补进 INGREDIENT_MAP）: ${unmapped.size}`);
if (unmapped.size) console.log("  → " + [...unmapped].join("、") + "\n");

const covered = Object.keys(PERFUMES).length - zero.length;
console.log(`\n覆盖健康度: ${covered}/${Object.keys(PERFUMES).length} 支有有效向量`);
