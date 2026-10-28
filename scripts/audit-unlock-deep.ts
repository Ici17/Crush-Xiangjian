/**
 * audit-unlock-deep.ts —— 解锁区「更深一层」解读门禁（F3）
 *
 * 它守的是**付费内容的体验下限**：这四段话是用户付了钱才看到的东西，
 * 一旦某条缺失 / 编了香调 / 复读了上面那段 / 通篇一个语气，都是「付了钱反而觉得亏」。
 *
 * 关键判据与其它门禁不同的一条：
 *   **零香调词**。三调、底稿、反差香香调都由现有 UI 从数据里给出，
 *   AI 在这一层再点一次香调就是在编事实（也一定有 1/225 的错配）。
 */

import { PERSONALITY_TYPES, PERFUMES } from "@/lib/data";
import { UNLOCK_DEEP } from "@/lib/data/unlockDeep";
import { UNLOCK_DEEP_BLOCKS, getUnlockDeep, type UnlockDeepBlock } from "@/lib/unlockDeep";
import {
  getHiddenFace,
  getScentAdvice,
  getScentBlueprint,
  getContrastScent,
  getScentPhilosophy,
} from "@/lib/personalities";
import { checkCopy, checkPriceClaims, buildNoteVocabulary } from "@/lib/contentGuard";
import { countNoteWords, echoSegments } from "./_narrativeQuality";

let pass = 0;
let fail = 0;
const ok = (m: string) => { pass++; console.log(`  ✅ ${m}`); };
const no = (m: string) => { fail++; console.log(`  ❌ ${m}`); };

console.log("══════ 解锁区深度解读门禁（F3）══════\n");

const BLOCK_LABEL: Record<UnlockDeepBlock, string> = {
  hidden: "隐藏人格面",
  relation: "关系解读",
  contrast: "反差香",
  blueprint: "气味底稿",
};

/** 每个区块「不许复述」的现有文案（与生成脚本保持同一套口径） */
function echoSourcesOf(per: string, block: UnlockDeepBlock, tagline: string): string[] {
  const base = [tagline];
  if (block === "hidden") {
    const h = getHiddenFace(per);
    return [...base, h.content, h.traits.join("")];
  }
  if (block === "relation") {
    const a = getScentAdvice(per);
    return [...base, a.firstMeeting, a.intimateRelation, a.relationAdvice];
  }
  if (block === "contrast") return [...base, getContrastScent(per)?.why ?? ""];
  return [...base, getScentBlueprint(per).signature, getScentPhilosophy(per)];
}

const vocab = buildNoteVocabulary(PERFUMES);
const names = PERSONALITY_TYPES.map((p) => p.name);

// ── A. 覆盖度 ──
console.log("A. 覆盖度");
const want = new Set<string>();
for (const n of names) for (const b of UNLOCK_DEEP_BLOCKS) want.add(`${n}::${b}`);
const entries = Object.entries(UNLOCK_DEEP);
const miss = [...want].filter((k) => !(k in UNLOCK_DEEP));
const extra = entries.map(([k]) => k).filter((k) => !want.has(k));
entries.length === want.size && miss.length === 0 && extra.length === 0
  ? ok(`${entries.length} 条 = ${names.length} 人格 × ${UNLOCK_DEEP_BLOCKS.length} 区块（无缺档、无孤儿）`)
  : no(`覆盖不全：缺 ${miss.length}（${miss.slice(0, 3).join("、")}）多 ${extra.length}`);

// ── B. 合规与零香调词 ──
console.log("\nB. 合规 / 零香调词 / 不复读");
const badCopy: string[] = [];
const noteHits: string[] = [];
const echoes: string[] = [];
const short: string[] = [];
const long: string[] = [];
for (const [k, v] of entries) {
  const [per, block] = k.split("::") as [string, UnlockDeepBlock];
  const tagline = PERSONALITY_TYPES.find((p) => p.name === per)?.tagline ?? "";
  for (const x of [...checkCopy(v), ...checkPriceClaims(v, null)]) {
    if (x.severity === "block") badCopy.push(`${k} 命中「${x.word}」`);
  }
  const nw = countNoteWords(v, vocab);
  if (nw.length) noteHits.push(`${k} 出现香调词「${nw.join("、")}」`);
  const ec = echoSegments(v, ...echoSourcesOf(per, block, tagline));
  if (ec.length) echoes.push(`${k}（${ec.join("、")}）`);
  if (v.length < 80) short.push(`${k}(${v.length})`);
  if (v.length > 170) long.push(`${k}(${v.length})`);
}
badCopy.length === 0
  ? ok(`${entries.length} 条全部过合规闸（红线词 / 价格主张）`)
  : no(`${badCopy.length} 条踩线：${badCopy.slice(0, 5).join("；")}`);
noteHits.length === 0
  ? ok("零香调词（香调事实由现有 UI 给出，AI 再点即编造）")
  : no(`${noteHits.length} 条点了香调词：${noteHits.slice(0, 5).join("；")}`);
echoes.length === 0
  ? ok("不复读同区块的现有文案 / 人格一句话")
  : no(`${echoes.length} 条复读：${echoes.slice(0, 5).join("；")}`);
short.length === 0 ? ok("没有过短的条目（≥80 字）") : no(`${short.length} 条过短：${short.slice(0, 5).join("、")}`);
if (long.length) console.log(`    ℹ️ ${long.length} 条超过 170 字（只提示不阻断，代价是页面高度）：${long.slice(0, 5).join("、")}`);

// ── C. 同区块不撞句 ──
console.log("\nC. 同区块不撞句");
const dup: string[] = [];
for (const b of UNLOCK_DEEP_BLOCKS) {
  const seen = new Map<string, string>();
  for (const [k, v] of entries) {
    if (!k.endsWith(`::${b}`)) continue;
    const prev = seen.get(v);
    if (prev) dup.push(`${prev} = ${k}`);
    else seen.set(v, k);
  }
}
dup.length === 0
  ? ok("四个区块内，16 个人格的说法互不相同")
  : no(`${dup.length} 组撞句：${dup.slice(0, 3).join("；")}`);

// ── D. 口吻塌缩线 ──
// 首轮 64 条里 7 个人格 4 条全含「往往/也许」，读起来是同一个人写的同一篇。
// 锁成「每人 ≤2 条」——用户只读自己人格那 4 条，按人格算才有意义。
console.log("\nD. 口吻塌缩");
const perRows = names.map((n) => {
  const vs = entries.filter(([k]) => k.startsWith(`${n}::`)).map(([, v]) => v);
  return {
    n,
    soft: vs.filter((v) => v.includes("往往") || v.includes("也许")).length,
    bu: vs.filter((v) => v.includes("不必")).length,
  };
});
const softBad = perRows.filter((r) => r.soft > 2);
const buBad = perRows.filter((r) => r.bu > 2);
softBad.length === 0
  ? ok(`「往往/也许」未塌缩（每人最多 ${Math.max(...perRows.map((r) => r.soft))}/4，上限 2）`)
  : no(`${softBad.length} 个人格软词超标：${softBad.map((r) => `${r.n}(${r.soft})`).join(" ")}`);
buBad.length === 0
  ? ok(`「不必」未塌缩（每人最多 ${Math.max(...perRows.map((r) => r.bu))}/4，上限 2）`)
  : no(`${buBad.length} 个人格「不必」超标：${buBad.map((r) => `${r.n}(${r.bu})`).join(" ")}`);

// ── E. 取值口 ──
console.log("\nE. 取值口（UI 唯一入口）");
getUnlockDeep(null, "hidden") === null && getUnlockDeep("不存在的人格", "hidden") === null
  ? ok("未知 / 空人格返回 null（界面整段不渲染，不会出现半截）")
  : no("未知人格竟然取到了文案");
const allReachable = names.every((n) => UNLOCK_DEEP_BLOCKS.every((b) => getUnlockDeep(n, b) !== null));
allReachable
  ? ok("16 人格 × 4 区块全部可取值")
  : no("有区块取不到值 → 付费用户会看到缺段");
const a1 = getUnlockDeep(names[0], "hidden");
a1 !== null && a1 === getUnlockDeep(names[0], "hidden")
  ? ok("同一输入结果稳定（确定性）")
  : no("取值不确定");

console.log(`\n══════ 结果：${pass} 通过 / ${fail} 失败 ══════`);
process.exit(fail > 0 ? 1 : 0);
