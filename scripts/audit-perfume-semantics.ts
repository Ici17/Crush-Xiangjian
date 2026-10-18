/**
 * audit-perfume-semantics.ts —— P2 离线语义层门禁
 *
 * 守四件事：
 *   A. 香调词覆盖：香水库里真实出现的每个词都必须在词典里有标注。
 *      未标注词会静默退化成「中性/无质感」，是最难发现的一类缺陷
 *      （不报错、不崩，只是悄悄少了一个信号），所以单独列出来当硬门禁。
 *   B. 产物覆盖：225 支香水每条都要有语义，且不能有 NaN / 越界。
 *   C. 取值合法：texture 的键必须在 ACTIVE_TEXTURES 内；分布和为 1。
 *   D. 分布健康：温度轴不能全挤在 0（说明词典没区分力），质感不能全空。
 */

import { PERFUMES } from "@/lib/data";
import { PERFUME_SEMANTICS } from "@/lib/data/perfumeSemantics";
import {
  lookupNoteSemantics,
  noteSemantics,
  ACTIVE_TEXTURES,
  ANNOTATED_NOTE_COUNT,
  type Texture,
} from "@/lib/data/noteSemantics";

let pass = 0;
let fail = 0;
const ok = (m: string) => { pass++; console.log(`  ✅ ${m}`); };
const no = (m: string) => { fail++; console.log(`  ❌ ${m}`); };

console.log("══════ P2 离线语义层门禁 ══════\n");

// ── A. 香调词覆盖 ──
console.log("A. 香调词词典覆盖度");
const usage = new Map<string, number>();
for (const p of Object.values(PERFUMES)) {
  for (const n of [...p.notes.top, ...p.notes.heart, ...p.notes.base]) {
    const k = n.trim();
    if (!k) continue;
    usage.set(k, (usage.get(k) ?? 0) + 1);
  }
}
const uncovered: Array<[string, number]> = [];
let coveredUses = 0;
let totalUses = 0;
for (const [w, c] of usage) {
  totalUses += c;
  if (lookupNoteSemantics(w)) coveredUses += c;
  else uncovered.push([w, c]);
}
uncovered.sort((a, b) => b[1] - a[1]);
const covPct = totalUses ? (coveredUses / totalUses) * 100 : 0;
console.log(`  词典已标注 ${ANNOTATED_NOTE_COUNT} 个词；香水库实际用到 ${usage.size} 个词 / ${totalUses} 次`);
console.log(`  按「出现次数」覆盖率：${covPct.toFixed(2)}%`);
if (uncovered.length === 0) {
  ok("香水库里出现的每个香调词都有语义标注");
} else {
  no(`有 ${uncovered.length} 个词未标注（按出现次数降序）`);
  for (const [w, c] of uncovered.slice(0, 40)) console.log(`      未标注：${w}（出现 ${c} 次）`);
  if (uncovered.length > 40) console.log(`      ……另有 ${uncovered.length - 40} 个`);
}
// 兜底一致性：noteSemantics 永不返回 undefined
const anyBad = [...usage.keys()].some((w) => {
  const s = noteSemantics(w);
  return typeof s.temp !== "number" || Number.isNaN(s.temp) || !s.texture;
});
anyBad ? no("noteSemantics 对某些词返回了非法值") : ok("noteSemantics 对所有词都返回合法值（含兜底）");

// ── B. 产物覆盖 ──
console.log("\nB. 语义产物覆盖与数值健康");
const ids = Object.keys(PERFUMES);
const missing = ids.filter((id) => !PERFUME_SEMANTICS[id]);
missing.length === 0
  ? ok(`225 支香水全部有语义（实际 ${ids.length} 条）`)
  : no(`有 ${missing.length} 支香水缺语义：${missing.slice(0, 10).join("、")}`);

let badTemp = 0;
let badTexKey = 0;
let badSum = 0;
let emptyTex = 0;
const temps: number[] = [];
for (const id of ids) {
  const s = PERFUME_SEMANTICS[id];
  if (!s) continue;
  if (typeof s.temp !== "number" || Number.isNaN(s.temp) || s.temp < -1 || s.temp > 1) badTemp++;
  else temps.push(s.temp);
  let sum = 0;
  for (const [k, v] of Object.entries(s.texture)) {
    if (!ACTIVE_TEXTURES.includes(k as Texture)) badTexKey++;
    if (typeof v !== "number" || Number.isNaN(v) || v < 0 || v > 1) badTexKey++;
    sum += v ?? 0;
  }
  if (Object.keys(s.texture).length === 0) emptyTex++;
  else if (Math.abs(sum - 1) > 1e-6) badSum++;
  if (!["day", "night", "any"].includes(s.dayNight)) badTexKey++;
}
badTemp === 0 ? ok("temp 全部落在 [-1, 1] 且非 NaN") : no(`${badTemp} 条 temp 越界或为 NaN`);
badTexKey === 0 ? ok("texture 键与 dayNight 取值全部合法") : no(`${badTexKey} 处取值非法`);
badSum === 0 ? ok("texture 分布和为 1") : no(`${badSum} 条 texture 分布和不为 1`);
emptyTex === 0
  ? ok("没有「质感全空」的香水")
  : no(`${emptyTex} 支香水质感全空（全部香调都是中性填充，匹配时会退化）`);

// ── C. 分布健康 ──
console.log("\nC. 分布健康度（词典是否真的有区分力）");
const avg = temps.reduce((a, b) => a + b, 0) / Math.max(1, temps.length);
const variance = temps.reduce((a, b) => a + (b - avg) ** 2, 0) / Math.max(1, temps.length);
const distinctTemps = new Set(temps.map((t) => Math.round(t * 100))).size;
console.log(`  temp 均值 ${avg.toFixed(4)} / 标准差 ${Math.sqrt(variance).toFixed(4)} / 不同取值 ${distinctTemps} 种`);
Math.sqrt(variance) > 0.05
  ? ok("temp 轴有足够方差（不是全部挤在 0）")
  : no("temp 轴几乎没有区分力（标准差 < 0.05），词典需要复核");
distinctTemps > 50
  ? ok("temp 取值足够分散")
  : no(`temp 只有 ${distinctTemps} 种取值，区分度不足`);

const texUse = new Map<Texture, number>();
for (const id of ids) {
  for (const [k, v] of Object.entries(PERFUME_SEMANTICS[id]?.texture ?? {})) {
    if ((v ?? 0) > 0) texUse.set(k as Texture, (texUse.get(k as Texture) ?? 0) + 1);
  }
}
console.log("  各质感被用到的香水数：");
for (const t of ACTIVE_TEXTURES) {
  console.log(`    ${t.padEnd(8)} ${texUse.get(t) ?? 0} 支`);
}
const unused = ACTIVE_TEXTURES.filter((t) => (texUse.get(t) ?? 0) === 0);
unused.length === 0
  ? ok("12 类质感全部被用上")
  : no(`以下质感从未出现，词典可能有遗漏：${unused.join("、")}`);

console.log(`\n══════ 结果：${pass} 通过 / ${fail} 失败 ══════`);
process.exit(fail > 0 ? 1 : 0);
