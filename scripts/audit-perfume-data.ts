/**
 * audit-perfume-data.ts —— 香水数据契约门禁（L0）
 *
 * 为什么需要它：
 * 未来无论是 AI 顾问做「预算 800 以内」的硬过滤，还是离线批量生成推荐文案，
 * 前提都是**香水数据是干净、结构化、可计算的**。而目前：
 *   · 价格是给人看的 `"¥1200-1600/50ml"`，程序比不了大小
 *   · 「必填字段非空」从没有机器保证过，靠人看
 *   · 文案合规靠人记，没有跑过全量
 *
 * 本门禁守四件事：
 *   A. 规模自洽：PERFUMES 条目数 === TOTAL_PERFUMES
 *   B. 价格 100% 可解析（这是预算过滤能成立的唯一前提；解析失败率必须是 0）
 *   C. 必填字段完整：名称/品牌/三调/扩散/留香/档位/描述
 *   D. 文案合规：225 条描述 + 16 人格全部文案过 contentGuard
 *
 * 之后陆续加了（产物本身就是数据层的一部分，必须跟着一起过闸）：
 *   E. 校验器自检（词表被改坏时这里会红）
 *   F. 人格 × 香水的「为什么是你」48 条
 *   G. CP 合香 136 条（含可交换性回归锁）
 *   H. 长尾 / 季节 / 预算挑选（含季节不退化）
 *   I. 单香档案 225 条（覆盖度双向全等 + 三道闸 + 不复读 description）
 *
 * A、B、C 与 E–I 的覆盖度/闸项是硬卡（有错就红）；D 的 warn 级只统计不阻断。
 */

import { PERFUMES, TOTAL_PERFUMES, PERSONALITY_TYPES } from "@/lib/data";
import { PERFUME_NARRATIVES } from "@/lib/data/perfumeNarratives";
import { CP_NARRATIVES } from "@/lib/data/cpNarratives";
import { PERFUME_PROFILES } from "@/lib/data/perfumeProfiles";
import { getCpResonance } from "@/lib/cpResonance";
import {
  pickLongTail,
  pickBySeason,
  pickByBudget,
  longTailPoolSize,
} from "@/lib/longTailPick";
import { getCalibratedRecommendations, type ScentVector } from "@/lib/matchPerfumes";
import { findPerfume } from "@/lib/discover";
import { countNoteWords, echoSegments, MAX_NOTE_WORDS_IN_LINE2 as MAX_NOTE_WORDS } from "./_narrativeQuality";
import { parsePriceRange } from "@/lib/priceRange";
import { checkCopy, checkPriceClaims, checkNoteClaims, buildNoteVocabulary } from "@/lib/contentGuard";

let pass = 0;
let fail = 0;
const ok = (m: string) => { pass++; console.log(`  ✅ ${m}`); };
const no = (m: string) => { fail++; console.log(`  ❌ ${m}`); };

console.log("══════ 香水数据契约门禁（L0）══════\n");

// ── A. 规模自洽 ──
console.log("A. 数据规模");
const keys = Object.keys(PERFUMES);
keys.length === TOTAL_PERFUMES
  ? ok(`PERFUMES 条目数 ${keys.length} 与 TOTAL_PERFUMES ${TOTAL_PERFUMES} 一致`)
  : no(`PERFUMES 条目数 ${keys.length} ≠ TOTAL_PERFUMES ${TOTAL_PERFUMES}（必有重复 key 或被覆盖的条目）`);
keys.length === 225
  ? ok("香水库规模 225 支（与对外宣称一致）")
  : no(`香水库规模 ${keys.length} 支，对外宣称 225 支`);
PERSONALITY_TYPES.length === 16
  ? ok("人格库 16 种")
  : no(`人格库 ${PERSONALITY_TYPES.length} 种，应为 16`);

// ── B. 价格可解析 ──
console.log("\nB. 价格结构化（预算过滤的前提）");
const unparsable: string[] = [];
let rangeWithCapacity = 0;
let singleWithCapacity = 0;
let noCapacity = 0;
const perMlList: number[] = [];
for (const key of keys) {
  const raw = PERFUMES[key]?.priceRange;
  const p = parsePriceRange(raw);
  if (!p) {
    unparsable.push(`${key} → "${raw ?? ""}"`);
    continue;
  }
  if (p.min === p.max && p.capacityMl) singleWithCapacity++;
  else if (p.capacityMl) rangeWithCapacity++;
  else noCapacity++;
  if (p.perMlMid !== null) perMlList.push(p.perMlMid);
}
if (unparsable.length === 0) {
  ok(`225 支价格 100% 可解析（区间+容量 ${rangeWithCapacity} / 单值+容量 ${singleWithCapacity} / 无容量 ${noCapacity}）`);
} else {
  no(`${unparsable.length} 支价格无法解析 → 这些香水在任何预算过滤场景都会「静默消失」`);
  for (const u of unparsable.slice(0, 20)) console.log(`      ${u}`);
}
if (noCapacity === 0) {
  ok("全部香水都有容量 → 每毫升价格可计算（跨容量比价的前提）");
} else {
  no(`${noCapacity} 支缺容量 → 无法做每毫升比价`);
}
if (perMlList.length > 0) {
  const sorted = [...perMlList].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length / 2)];
  console.log(`    每毫升价格中位 ¥${p50}（区间 ¥${sorted[0]} ~ ¥${sorted[sorted.length - 1]}）`);
}

// ── C. 必填字段完整 ──
console.log("\nC. 必填字段完整性");
const missing: string[] = [];
let longDesc = 0;
for (const key of keys) {
  const p = PERFUMES[key];
  const problems: string[] = [];
  if (!p.name?.trim()) problems.push("name");
  if (!p.brand?.trim()) problems.push("brand");
  if (!p.brandCn?.trim()) problems.push("brandCn");
  if (!p.notes?.top?.length) problems.push("notes.top");
  if (!p.notes?.heart?.length) problems.push("notes.heart");
  if (!p.notes?.base?.length) problems.push("notes.base");
  if (!(p.intensity >= 1 && p.intensity <= 5)) problems.push("intensity");
  if (!(p.longevity >= 1 && p.longevity <= 5)) problems.push("longevity");
  if (p.tier !== "premium" && p.tier !== "budget") problems.push("tier");
  if (!p.description?.trim()) problems.push("description");
  if (p.description && p.description.length > 60) longDesc++;
  if (problems.length) missing.push(`${key} → 缺 ${problems.join("/")}`);
}
if (missing.length === 0) {
  ok("225 支必填字段全部完整（名称/中英品牌/三调/扩散/留香/档位/描述）");
} else {
  no(`${missing.length} 支必填字段缺失`);
  for (const m of missing.slice(0, 20)) console.log(`      ${m}`);
}
if (longDesc > 0) {
  console.log(`    ℹ️ ${longDesc} 支描述超过 60 字（接口注释约定 50 字以内，仅提醒不阻断）`);
}

// ── D. 文案合规 ──
console.log("\nD. 文案合规（contentGuard 全量扫描）");
const blockHits: string[] = [];
const warnHits: string[] = [];
for (const key of keys) {
  const p = PERFUMES[key];
  for (const v of checkCopy(p.description)) {
    const line = `[香水] ${key} · ${v.label} · 命中「${v.word}」→ ${v.snippet}`;
    (v.severity === "block" ? blockHits : warnHits).push(line);
  }
}
for (const per of PERSONALITY_TYPES) {
  const fields: Array<[string, string]> = [
    ["tagline", per.tagline],
    ["description", per.description],
    ["scentDirection", per.scentDirection],
    ["matchingReport.coreMessage", per.matchingReport?.coreMessage],
    ["matchingReport.personalityAnalysis", per.matchingReport?.personalityAnalysis],
    ["matchingReport.scentPhilosophy", per.matchingReport?.scentPhilosophy],
    ["matchingReport.growthSuggestion", per.matchingReport?.growthSuggestion],
  ];
  for (const [field, text] of fields) {
    for (const v of checkCopy(text)) {
      const line = `[人格] ${per.name}.${field} · ${v.label} · 命中「${v.word}」→ ${v.snippet}`;
      (v.severity === "block" ? blockHits : warnHits).push(line);
    }
  }
}
if (blockHits.length === 0) {
  ok("现有静态文案无迷信 / 医疗 / 财务法律红线命中");
} else {
  no(`现有静态文案命中 ${blockHits.length} 处红线（上线前必须处理）`);
  for (const h of blockHits.slice(0, 25)) console.log(`      ${h}`);
}
if (warnHits.length === 0) {
  ok("无广告法极限词");
} else {
  console.log(`    ⚠️ ${warnHits.length} 处广告法极限词（仅提醒，不阻断）：`);
  for (const h of warnHits.slice(0, 12)) console.log(`      ${h}`);
}

// ── E. 校验器自检 ──
// 为什么必须自检：contentGuard 是「防线」，但防线本身也会失效 ——
// 如果哪天有人觉得「助眠不算医疗暗示」把它从词表里删掉，
// D 项会安静地继续全绿，而违规文案会一路走到线上。
// 所以每类规则都要拿一段必错的样例锁死：抓不到就是门禁坏了。
console.log("\nE. 校验器自检（规则被误删时这里会报红）");
const SELF_TESTS: Array<{ name: string; text: string; expectRuleId: string }> = [
  { name: "迷信", text: "助你转运改命的木质调", expectRuleId: "superstition" },
  { name: "医疗", text: "治愈焦虑的晚间香气", expectRuleId: "medical" },
  { name: "财务法律", text: "这款香适合投资收藏", expectRuleId: "finance-law" },
];
for (const t of SELF_TESTS) {
  const hits = checkCopy(t.text);
  hits.some((v) => v.ruleId === t.expectRuleId)
    ? ok(`能抓到「${t.name}」类违规（${t.expectRuleId}）`)
    : no(`抓不到「${t.name}」类违规 → 词表可能已被改坏`);
}
// 价格编造：文案里的 ¥ 数字必须落在香水区间内
{
  const hits = checkPriceClaims("只要 ¥9999 就能带走", { min: 100, max: 200 });
  hits.some((v) => v.ruleId === "price-claim")
    ? ok("能抓到超出区间的价格主张（防模型编造价格）")
    : no("抓不到价格编造 → 价格闸已失效");
}
// 无可靠价格时，出现任何 ¥ 数字都应报红
{
  const hits = checkPriceClaims("只要 ¥999 就能带走", null);
  hits.some((v) => v.ruleId === "price-claim")
    ? ok("价格未知时，出现具体价格会被拦下")
    : no("价格未知时漏放了具体价格");
}
// 香调白名单闸：文案里的香调词必须是这支香真实拥有的。
// ⚠️ 挑词必须动态挑 —— 写死「佛手柑/雪松」会因为某支香恰好有它们而变成假绿。
{
  const vocab = buildNoteVocabulary(PERFUMES);
  const pf = Object.values(PERFUMES)[0];
  const owned = [...pf.notes.top, ...pf.notes.heart, ...pf.notes.base, pf.description].join(" ");
  const foreign = vocab.find((w) => !owned.includes(w));
  const real = pf.notes.top[0];
  if (!foreign || !real || vocab.length < 50) {
    no(`香调白名单闸自检无法构造样例（词表 ${vocab.length} 条，或三调为空）`);
  } else {
    const caught = checkNoteClaims(`前调是${foreign}，很特别`, pf, vocab);
    const wrong = checkNoteClaims(`前调是${real}`, pf, vocab);
    caught.length > 0 && wrong.length === 0
      ? ok(`香调白名单闸能抓到越界香调词（如「${foreign}」），且不误伤真实香调（如「${real}」）`)
      : no(`香调白名单闸异常：越界项=${caught.length} 真实项误报=${wrong.length}`);
  }
}

// 干净文案必须零命中（防词表被误伤到正常文案）
{
  const clean = "清冽的木质与微苦的柚皮，適合通勤的清淡一日。留香 3-4，扩散适中。";
  checkCopy(clean).length === 0
    ? ok("正常文案零误报")
    : no(`正常文案被误报：${checkCopy(clean).map((v) => v.word).join("/")}`);
}

// ── F. L1 离线文案产物（人格 × 香水的「为什么是你」）──
// 为什么在这里而不是单独一个脚本：产物本身就是数据层的一部分，
// 它的覆盖度与合规必须和其他数据契约一起过闸，否则会变成「只有生成时检查过一次」。
console.log("\nF. L1 离线文案产物（perfumeNarratives）");
{
  const vocab = buildNoteVocabulary(PERFUMES);
  const entries = Object.entries(PERFUME_NARRATIVES);
  const expected = PERSONALITY_TYPES.length * 3; // 每人格 3 支（本命/进阶/尝试）
  entries.length === expected
    ? ok(`文案条数 ${entries.length} = 16 人格 × 3 支（完整覆盖结果页）`)
    : no(`文案条数 ${entries.length}，应为 ${expected} → 有用户会看到「没有解读」的卡片`);

  const perPerson = new Map<string, number>();
  const badKey: string[] = [];
  const badCopy: string[] = [];
  for (const [key, n] of entries) {
    const [pName, pfName] = key.split("::");
    if (!pName || !pfName || !PERSONALITY_TYPES.some((p) => p.name === pName)) {
      badKey.push(`${key}（人格名不合法）`);
      continue;
    }
    const pf = findPerfume(pfName);
    if (!pf) {
      badKey.push(`${key}（香水名查不到，注意库里有 2 支「键≠名」）`);
      continue;
    }
    perPerson.set(pName, (perPerson.get(pName) ?? 0) + 1);
    const text = `${n.line1} ${n.line2}`;
    const blocks = [
      ...checkCopy(text),
      ...checkPriceClaims(text, null),
      ...checkNoteClaims(text, pf, vocab),
    ].filter((v) => v.severity === "block");
    if (blocks.length) {
      badCopy.push(`${key} → ${blocks.map((b) => `${b.label}「${b.word}」`).join("；")}`);
    }
    if (!n.line1?.trim() || !n.line2?.trim()) badCopy.push(`${key} → 有空句`);
  }

  badKey.length === 0
    ? ok("所有键都合法（人格名存在、香水名可被 findPerfume 解析）")
    : no(`${badKey.length} 个键不合法：${badKey.slice(0, 5).join("；")}`);
  const incomplete = [...perPerson.entries()].filter(([, c]) => c !== 3);
  incomplete.length === 0
    ? ok("每个人格都是完整的 3 条")
    : no(`这些人格的文案不全：${incomplete.map(([p, c]) => `${p}(${c})`).join(" ")}`);
  badCopy.length === 0
    ? ok("全部文案过三道闸（红线词 / 价格主张 / 香调白名单）")
    : no(`${badCopy.length} 条文案未过闸：${badCopy.slice(0, 5).join("；")}`);
}

// ── G. L1 离线文案产物（CP 合香）──
// 与 F 项同一套理由：产物是数据层的一部分，必须跟着一起过闸。
// 三条额外硬约束：
//   ① 条数 = C(16+1,2) = 136（不是 256）—— 合香卡可交换，两个方向同一句。
//      哪天有人改回 256，说明有人把「可交换」这个前提破坏了。
//   ② 键内两人名必须已排序 —— 否则 A×B 和 B×A 会查到两条，且只有一条有文案。
//   ③ 可交换性：getCpResonance(A,B) 必须等于 getCpResonance(B,A)。
//      这是 2026-10-22 修掉的 bug（原先 256 对里 240 对不可交换），必须锁死不回退。
console.log("\nG. L1 离线文案产物（cpNarratives · CP 合香）");
{
  const vocab = buildNoteVocabulary(PERFUMES);
  const entries = Object.entries(CP_NARRATIVES);
  const n = PERSONALITY_TYPES.length;
  const expected = (n * (n + 1)) / 2; // 无序对，含自配
  entries.length === expected
    ? ok(`文案条数 ${entries.length} = C(${n}+1,2)（合香卡可交换，故非 ${n * n}）`)
    : no(`文案条数 ${entries.length}，应为 ${expected} → 有人格对会回落到通用分档文案`);

  const unsorted: string[] = [];
  const badKey: string[] = [];
  const badCopy: string[] = [];
  const tooManyNotes: string[] = [];
  for (const [key, v] of entries) {
    const [a, b] = key.split("::");
    if (!a || !b || !PERSONALITY_TYPES.some((p) => p.name === a) || !PERSONALITY_TYPES.some((p) => p.name === b)) {
      badKey.push(`${key}（人格名不合法）`);
      continue;
    }
    if (a > b) unsorted.push(key); // 键未排序 → A×B 与 B×A 会查到不同条目
    const cp = getCpResonance(a, b);
    if (!cp) {
      badKey.push(`${key}（合香算不出来）`);
      continue;
    }
    const text = `${v.line} ${v.hint}`;
    const blocks = [
      ...checkCopy(text),
      ...checkPriceClaims(text, null),
      // 合香三调当「这支香的三调」喂给白名单闸：文案不得提合香没有的香调
      ...checkNoteClaims(text, { name: cp.blendName, notes: { top: cp.top, heart: cp.heart, base: cp.base } } as never, vocab),
    ].filter((x) => x.severity === "block");
    if (blocks.length) badCopy.push(`${key} → ${blocks.map((x) => `${x.label}「${x.word}」`).join("；")}`);
    if (!v.line?.trim() || !v.hint?.trim()) badCopy.push(`${key} → 有空句`);
    const hits = countNoteWords(text, vocab);
    if (hits.length > MAX_NOTE_WORDS) tooManyNotes.push(`${key}（${hits.length} 个：${hits.join("、")}）`);
  }

  badKey.length === 0
    ? ok("所有键都合法（人格名存在、合香可算）")
    : no(`${badKey.length} 个键不合法：${badKey.slice(0, 5).join("；")}`);
  unsorted.length === 0
    ? ok("键内两人名均已排序（A×B 与 B×A 命中同一条）")
    : no(`${unsorted.length} 个键未排序：${unsorted.slice(0, 5).join("；")}`);
  badCopy.length === 0
    ? ok("全部文案过三道闸（红线词 / 价格主张 / 香调白名单）")
    : no(`${badCopy.length} 条文案未过闸：${badCopy.slice(0, 5).join("；")}`);
  tooManyNotes.length === 0
    ? ok(`香调词均不超过 ${MAX_NOTE_WORDS} 个（多则成成分表）`)
    : no(`${tooManyNotes.length} 条香调词超限：${tooManyNotes.slice(0, 5).join("；")}`);

  // 可交换性回归锁：这条挂了说明有人把 cpResonance 的排序改回去了
  const names = PERSONALITY_TYPES.map((p) => p.name);
  const asym: string[] = [];
  for (const a of names) {
    for (const b of names) {
      const x = getCpResonance(a, b);
      const y = getCpResonance(b, a);
      if (!x || !y) continue;
      if (
        x.blendName !== y.blendName ||
        x.top.join() !== y.top.join() ||
        x.heart.join() !== y.heart.join() ||
        x.base.join() !== y.base.join() ||
        x.seal !== y.seal ||
        x.diffTones !== y.diffTones ||
        x.toneA !== y.toneA
      ) asym.push(`${a}×${b}`);
    }
  }
  asym.length === 0
    ? ok("合香卡完全可交换（A×B ≡ B×A，256 对全部一致）")
    : no(`${asym.length} 对不可交换：${asym.slice(0, 5).join("、")} → 同一个人 CP 两人会看到不同的卡`);
}

// ── H. 长尾 / 追问挑选（结果页「想问点别的」）──
// 这些挑选不进推荐主链路，但同样是数据层的产物，必须跟着过闸。
// 最关键的一条是**季节不退化**：首版把 PERFUME_SEMANTICS.temp（尺度 -1~1）
// 当成 0-100 用，季节项退化成常数，1/4/7/10 四个月返回完全一样的结果 ——
// 界面上完全看不出来，只有跨月份对比才能发现。
console.log("\nH. 长尾 / 追问挑选（longTailPick）");
{
  const v0 = PERSONALITY_TYPES[0].radarScores as unknown as ScentVector;
  const pool = longTailPoolSize();
  pool > 0
    ? ok(`长尾池 ${pool} 支（canonical 之外的候选非空）`)
    : no("长尾池为空 → 「来点少见的」会永远没结果");

  // 长尾不得与 16 原型 canonical 推荐重叠（否则就不是「平时轮不到」的那批了）
  const canonSet = new Set<string>();
  for (const arch of PERSONALITY_TYPES) {
    for (const rec of getCalibratedRecommendations(
      arch.radarScores as unknown as ScentVector,
      ["cal1b", "cal2b", "cal3b"],
      [],
      arch.id,
      true,
    )) canonSet.add(rec.name);
  }
  let overlap = 0;
  for (const arch of PERSONALITY_TYPES) {
    const v = arch.radarScores as unknown as ScentVector;
    const excl = getCalibratedRecommendations(v, ["cal1b", "cal2b", "cal3b"], [], arch.id, false).map(
      (r) => r.name,
    );
    for (const p of pickLongTail(v, excl, "gate-vid", 3)) {
      if (canonSet.has(p.name) || excl.includes(p.name)) overlap++;
    }
  }
  overlap === 0
    ? ok("长尾挑选与三香 / canonical 零重叠")
    : no(`${overlap} 支同时出现在三香或 canonical 里 → 「少见的」并不少见`);

  // 确定性：同一 vid 必须永远同一批（否则用户刷新就换一批，像 bug）
  const a1 = pickLongTail(v0, [], "gate-vid", 3).map((p) => p.name).join();
  const a2 = pickLongTail(v0, [], "gate-vid", 3).map((p) => p.name).join();
  a1 === a2
    ? ok("同一 vid 结果稳定（刷新不换一批）")
    : no("同一 vid 两次结果不同 → 用户刷新会看到不同的香");

  // 季节不退化（首版踩过的坑）
  const w = pickBySeason(v0, [], "gate-vid", 1, 3).map((p) => p.name).join();
  const s = pickBySeason(v0, [], "gate-vid", 7, 3).map((p) => p.name).join();
  w !== s
    ? ok("季节挑选在冬 / 夏两月给出不同结果（防 temp 尺度退化）")
    : no("冬季与夏季结果相同 → 季节项已退化（检查 temp 是否为 -1~1 尺度）");

  // 预算必须真的落在预算内
  const cheap = pickByBudget(v0, [], "gate-vid", 800, 3);
  const over = cheap.filter((p) => {
    const pr = parsePriceRange(p.priceRange);
    return pr === null || pr.min > 800;
  });
  over.length === 0
    ? ok("预算挑选全部落在预算内（区间下限 ≤ 800）")
    : no(`${over.length} 支超出预算：${over.map((p) => `${p.name}(${p.priceRange})`).join("、")}`);
}

// ── I. L1 离线文案产物（单香档案 · F7）──
// 225 条不乘人格，键 = PERFUMES 的键（库里有 2 支「键≠展示名」，按键存最稳）。
// 硬约束：
//   ① 覆盖度必须是双向全等的 225 条 —— 少一条，那支香在探索页就回落到
//      通用 description；多一条则是脏数据。
//   ② 与生成脚本同一套闸（红线 / 价格主张按真实区间 / 香调白名单），
//      防止「生成时检查过一次、之后手改/重生成时无人再查」。
//   ③ line 不得复读 PERFUMES.description —— 档案的价值是「新的说法」，
//      与旧描述撞句就是白花生成成本。
console.log("\nI. L1 离线文案产物（perfumeProfiles · 单香档案）");
{
  const vocab = buildNoteVocabulary(PERFUMES);
  const entries = Object.entries(PERFUME_PROFILES);

  // 覆盖度：键集合与香水库双向全等
  const pfKeys = new Set(Object.keys(PERFUMES));
  const prKeys = new Set(entries.map(([k]) => k));
  const missingProfiles = [...pfKeys].filter((k) => !prKeys.has(k));
  const orphanProfiles = [...prKeys].filter((k) => !pfKeys.has(k));
  entries.length === keys.length && missingProfiles.length === 0 && orphanProfiles.length === 0
    ? ok(`覆盖度 ${entries.length} = 香水库 ${keys.length}，键集合双向全等（无缺档、无孤儿）`)
    : no(`覆盖度不对：缺档 ${missingProfiles.length} 支（${missingProfiles.slice(0, 5).join("、")}${missingProfiles.length > 5 ? "…" : ""}），孤儿 ${orphanProfiles.length} 支（${orphanProfiles.slice(0, 5).join("、")}）`);

  const badCopy: string[] = [];
  const tooManyNotes: string[] = [];
  const echoes: string[] = [];
  for (const [id, v] of entries) {
    const p = PERFUMES[id];
    if (!p) continue; // 孤儿键已在上面报过
    const text = `${v.line} ${v.hint}`;
    const blocks = [
      ...checkCopy(text),
      ...checkPriceClaims(text, parsePriceRange(p.priceRange)),
      ...checkNoteClaims(text, p, vocab),
    ].filter((x) => x.severity === "block");
    if (blocks.length) badCopy.push(`${id} → ${blocks.map((x) => `${x.label}「${x.word}」`).join("；")}`);
    if (!v.line?.trim() || !v.hint?.trim()) badCopy.push(`${id} → 有空句`);
    const hits = countNoteWords(text, vocab);
    if (hits.length > MAX_NOTE_WORDS) tooManyNotes.push(`${id}（${hits.length} 个：${hits.join("、")}）`);
    const dup = echoSegments(v.line ?? "", p.description);
    if (dup.length) echoes.push(`${id}（复读：${dup.join("、")}）`);
  }

  badCopy.length === 0
    ? ok("全部档案过三道闸（红线词 / 价格主张按真实区间 / 香调白名单）")
    : no(`${badCopy.length} 条未过闸：${badCopy.slice(0, 5).join("；")}`);
  tooManyNotes.length === 0
    ? ok(`香调词均不超过 ${MAX_NOTE_WORDS} 个（多则成成分表）`)
    : no(`${tooManyNotes.length} 条香调词超限：${tooManyNotes.slice(0, 5).join("；")}`);
  echoes.length === 0
    ? ok("档案文案与现有 description 零复读")
    : no(`${echoes.length} 条复读旧描述：${echoes.slice(0, 5).join("；")}`);
}

console.log(`\n══════ 结果：${pass} 通过 / ${fail} 失败 ══════`);
process.exit(fail > 0 ? 1 : 0);
