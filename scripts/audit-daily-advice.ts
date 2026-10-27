/**
 * audit-daily-advice.ts —— 「今日穿香建议」门禁
 *
 * 它守的不是代码正确性，是**体验下限**：
 *   · 一年 365 天，每一天都必须出满 3 支（空卡比给一支不完美的更糟）
 *   · 同一天必须抽到同一批（确定性 = 特性，与香签同源）
 *   · 候选必须真的满足卡上写出的条件（卡上写「扩散≤2」就不能塞一支扩散 5 的进来，那是骗人）
 *   · 一年下来要够多样（别天天推同一支，那等于没有建议）
 *   · 文案不能踩项目红线
 *
 * 顺带它也是**调参台**：改完 lib/daily/advice.ts 顶部的 TERM_ADVICE 表，
 * 跑一遍就能看到「全年候选分布 / 触发兜底的天数 / 条件是否合理」，
 * 不用在手机上翻 24 个节气。
 */

import { getScentAdvice, getAdvicePerfumes, TERM_ADVICE } from "@/lib/daily/advice";
import { checkCopy, checkPriceClaims, buildNoteVocabulary } from "@/lib/contentGuard";
import { PERFUMES, PERSONALITY_TYPES } from "@/lib/data";
import { NOTE_POOL } from "@/lib/daily/almanac";
import { SIGN_LINES, SIGN_WORDS } from "@/lib/data/dailySigns";
import {
  getSignFamily,
  SIGN_FAMILIES,
  FAMILY_LABEL,
  getSignLine,
  getSignWord,
} from "@/lib/daily/signCopy";
import { countNoteWords, echoSegments } from "./_narrativeQuality";

let pass = 0;
let fail = 0;
const ok = (m: string) => { pass++; console.log(`  ✅ ${m}`); };
const no = (m: string) => { fail++; console.log(`  ❌ ${m}`); };

console.log("══════ 今日穿香建议门禁 ══════\n");

const YEAR = 2026;
const days: string[] = [];
for (let m = 1; m <= 12; m++) {
  const last = new Date(YEAR, m, 0).getDate();
  for (let d = 1; d <= last; d++) {
    days.push(`${YEAR}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
}

// ── A. 节气表覆盖 ──
console.log("A. 节气配置覆盖");
const SOLAR_24 = [
  "小寒", "大寒", "立春", "雨水", "惊蛰", "春分", "清明", "谷雨",
  "立夏", "小满", "芒种", "夏至", "小暑", "大暑", "立秋", "处暑",
  "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪", "冬至",
];
const missingTerms = SOLAR_24.filter((t) => !TERM_ADVICE[t]);
missingTerms.length === 0
  ? ok(`24 节气全部配好条件（共 ${Object.keys(TERM_ADVICE).length} 条）`)
  : no(`这些节气没配条件：${missingTerms.join("/")} → 当天会走兜底配置`);

// ── B. 每天都出满 + 确定性 ──
console.log("\nB. 全年可用性与确定性");
let shortDays = 0;
let unstableDays = 0;
let relaxedDays = 0;
const allPicked: string[] = [];
const perTerm = new Map<string, number>();
const termRelaxed = new Map<string, number>();

for (const d of days) {
  const r1 = getAdvicePerfumes(d, 3);
  const r2 = getAdvicePerfumes(d, 3);
  if (r1.perfumes.length < 3) shortDays++;
  if (r1.level > 0) {
    relaxedDays++;
    const t = r1.advice.term;
    termRelaxed.set(t, (termRelaxed.get(t) ?? 0) + 1);
  }
  if (r1.perfumes.map((p) => p.id).join("|") !== r2.perfumes.map((p) => p.id).join("|")) {
    unstableDays++;
  }
  for (const p of r1.perfumes) allPicked.push(p.id);
  perTerm.set(r1.advice.term, (perTerm.get(r1.advice.term) ?? 0) + 1);
}

days.length === 365 ? ok(`扫描 ${days.length} 天（${YEAR} 全年）`) : no(`年份天数异常：${days.length}`);
shortDays === 0
  ? ok("每天都能出满 3 支（无空卡）")
  : no(`${shortDays} 天凑不满 3 支 → 当天卡片会变短或空`);
unstableDays === 0
  ? ok("同一天多次调用结果完全一致（确定性）")
  : no(`${unstableDays} 天两次调用结果不同 → 用户刷新会看到不同建议`);

// ── C. 候选真的满足卡上条件 ──
console.log("\nC. 候选与公示条件一致（卡上写什么就得是什么）");
let violate = 0;
for (const d of days) {
  const { applied, perfumes } = getAdvicePerfumes(d, 3);
  for (const p of perfumes) {
    if (applied.maxIntensity !== null && p.intensity > applied.maxIntensity) violate++;
    if (p.longevity < applied.minLongevity) violate++;
  }
}
violate === 0
  ? ok("全年候选都满足卡上公示的条件（公示值 = 实际生效值）")
  : no(`${violate} 支候选不满足公示条件 → 卡上写「扩散≤N」却给了更大的，等于骗人`);

// ── D. 多样性 ──
console.log("\nD. 全年多样性");
const unique = new Set(allPicked);
const top = [...allPicked.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())]
  .sort((a, b) => b[1] - a[1]);
unique.size >= 60
  ? ok(`全年共出现 ${unique.size} 支不同香水（总抽取 ${allPicked.length} 次）`)
  : no(`全年只出现 ${unique.size} 支 → 建议卡天天重复，失去意义`);
if (top.length > 0) {
  const [most, count] = top[0];
  const rate = ((count / allPicked.length) * 100).toFixed(1);
  count / allPicked.length <= 0.08
    ? ok(`最常出现的是「${most}」${count} 次（占 ${rate}%，未过度集中）`)
    : no(`「${most}」一年出现 ${count} 次（占 ${rate}%）→ 过于集中`);
}

// ── E. 节气分布与兜底 ──
console.log("\nE. 节气区间与兜底");
const termMiss = [...perTerm.keys()].filter((t) => !TERM_ADVICE[t]);
termMiss.length === 0
  ? ok(`全年覆盖 ${perTerm.size} 个节气区间`)
  : no(`这些节气区间没配置：${termMiss.join("/")}`);
console.log(`    ℹ️ 需要放宽条件的天数：${relaxedDays} / ${days.length}`);
// 关键：放宽只该是偶发。某个节气天天要靠放宽 = 表里那条定得脱离香水库实际，
// 必须回来改表，不能让兜底替它兜一辈子。
const chronic = [...termRelaxed.entries()]
  .filter(([t, n]) => {
    const total = perTerm.get(t) ?? 1;
    return n / total > 0.5;
  })
  .map(([t, n]) => `${t}(${n}/${perTerm.get(t)})`);
if (chronic.length === 0) {
  ok("没有节气常年依赖放宽（条件定得切合香水库实际）");
} else {
  no(`这些节气超过一半日子要靠放宽 → 回来改 TERM_ADVICE：${chronic.join(" ")}`);
}

// ── F. 文案合规 ──
console.log("\nF. 文案合规（contentGuard）");
const badNotes: string[] = [];
for (const t of SOLAR_24) {
  const a = TERM_ADVICE[t];
  if (!a) continue;
  for (const v of checkCopy(a.note)) {
    if (v.severity === "block") badNotes.push(`${t}「${a.note}」命中「${v.word}」`);
  }
}
badNotes.length === 0
  ? ok("24 条节气文案无迷信 / 医疗 / 财务红线命中")
  : no(`${badNotes.length} 条节气文案踩红线`);

// ── F5. 香签个性化文案（签面短评 × 人格 × 香调族 + 今日一语改写）──
// 这一段的判据与其它项不同：这些句子会配到**任意一支香**上，
// 所以「出现任何香调词」本身就是错配（224/225 的场合是错的），比 checkNoteClaims 更严。
console.log("\nF5. 香签个性化文案（dailySigns）");
{
  const vocab = buildNoteVocabulary(PERFUMES);
  const perNames = PERSONALITY_TYPES.map((p) => p.name);

  // ① 覆盖度：短评 16×6、一语 16×8，且键集合必须双向全等（缺一条就有用户回到原描述）
  const wantLines = new Set<string>();
  for (const n of perNames) for (const f of SIGN_FAMILIES) wantLines.add(`${n}::${f}`);
  const wantWords = new Set<string>();
  for (const n of perNames) for (let i = 0; i < NOTE_POOL.length; i++) wantWords.add(`${n}::${i}`);

  const missL = [...wantLines].filter((k) => !(k in SIGN_LINES));
  const extraL = Object.keys(SIGN_LINES).filter((k) => !wantLines.has(k));
  missL.length === 0 && extraL.length === 0 && Object.keys(SIGN_LINES).length === wantLines.size
    ? ok(`签面短评 ${Object.keys(SIGN_LINES).length} 条 = ${perNames.length} 人格 × ${SIGN_FAMILIES.length} 族（无缺档、无孤儿）`)
    : no(`短评覆盖不全：缺 ${missL.length}（${missL.slice(0, 3).join("、")}）多 ${extraL.length}`);

  const missW = [...wantWords].filter((k) => !(k in SIGN_WORDS));
  const extraW = Object.keys(SIGN_WORDS).filter((k) => !wantWords.has(k));
  missW.length === 0 && extraW.length === 0 && Object.keys(SIGN_WORDS).length === wantWords.size
    ? ok(`今日一语 ${Object.keys(SIGN_WORDS).length} 条 = ${perNames.length} 人格 × ${NOTE_POOL.length} 句（无缺档、无孤儿）`)
    : no(`一语覆盖不全：缺 ${missW.length}（${missW.slice(0, 3).join("、")}）多 ${extraW.length}`);

  // ② 六个族都必须真有香落进来 —— 否则那 16 条文案永远没人看到（死库存的另一种形态）
  const famCount: Record<string, number> = {};
  for (const p of Object.values(PERFUMES)) {
    const f = getSignFamily({ name: p.name });
    if (f) famCount[f] = (famCount[f] ?? 0) + 1;
  }
  const emptyFam = SIGN_FAMILIES.filter((f) => !famCount[f]);
  emptyFam.length === 0
    ? ok(`6 族都有香落地（${SIGN_FAMILIES.map((f) => `${FAMILY_LABEL[f]} ${famCount[f]}`).join(" / ")}）`)
    : no(`${emptyFam.length} 个族没有任何香 → 对应 ${emptyFam.length * perNames.length} 条文案永远不会出现`);

  // ③ 每一条都过闸
  const badCopy: string[] = [];
  const noteHits: string[] = [];
  const echoes: string[] = [];
  const noPunct: string[] = [];
  for (const [k, v] of Object.entries(SIGN_LINES)) {
    const per = perNames.find((n) => k.startsWith(`${n}::`));
    const tagline = PERSONALITY_TYPES.find((p) => p.name === per)?.tagline ?? "";
    const pm = PERSONALITY_TYPES.find((p) => p.name === per)?.matchingReport?.coreMessage ?? "";
    for (const x of [...checkCopy(v), ...checkPriceClaims(v, null)]) {
      if (x.severity === "block") badCopy.push(`${k} 命中「${x.word}」`);
    }
    const nw = countNoteWords(v, vocab);
    if (nw.length) noteHits.push(`${k} 出现香调词「${nw.join("、")}」`);
    if (echoSegments(v, tagline, pm).length) echoes.push(k);
    if (!/[。！？]$/.test(v)) noPunct.push(k);
  }
  for (const [k, v] of Object.entries(SIGN_WORDS)) {
    const idx = Number(k.split("::")[1]);
    for (const x of [...checkCopy(v), ...checkPriceClaims(v, null)]) {
      if (x.severity === "block") badCopy.push(`${k} 命中「${x.word}」`);
    }
    const nw = countNoteWords(v, vocab);
    if (nw.length) noteHits.push(`${k} 出现香调词「${nw.join("、")}」`);
    if (echoSegments(v, NOTE_POOL[idx] ?? "").length) echoes.push(k);
    if (!/[。！？]$/.test(v)) noPunct.push(k);
  }
  badCopy.length === 0
    ? ok("224 条全部过合规闸（红线词 / 价格主张）")
    : no(`${badCopy.length} 条踩线：${badCopy.slice(0, 5).join("；")}`);
  noteHits.length === 0
    ? ok("零香调词（会被配到任意一支香上，出现即错配）")
    : no(`${noteHits.length} 条点了香调词：${noteHits.slice(0, 5).join("；")}`);
  echoes.length === 0
    ? ok("不复读人格一句话 / 今日一语原句")
    : no(`${echoes.length} 条复读底稿：${echoes.slice(0, 5).join("、")}`);
  noPunct.length === 0
    ? ok("句末标点统一")
    : no(`${noPunct.length} 条缺句末标点：${noPunct.slice(0, 5).join("、")}`);

  // ④ 同组不撞句（同族不同人格、同原句不同人格，说法必须不同）
  const groupDup: string[] = [];
  for (const [keyOf, table] of [
    ["line", SIGN_LINES],
    ["word", SIGN_WORDS],
  ] as const) {
    const seen = new Map<string, string>();
    for (const [k, v] of Object.entries(table)) {
      const g = `${keyOf}:${k.split("::")[1]}|${v}`;
      const prev = seen.get(g);
      if (prev) groupDup.push(`${prev} = ${k}`);
      else seen.set(g, k);
    }
  }
  groupDup.length === 0
    ? ok("同组无撞句（各组内说法互不相同）")
    : no(`${groupDup.length} 组撞句：${groupDup.slice(0, 3).join("；")}`);

  // ⑤ 句式塌缩线：首轮 36% 的条目带「不必」，读起来是模板。锁成「每人 ≤ 3 条」
  const perBu = new Map<string, number>();
  for (const [k, v] of [...Object.entries(SIGN_LINES), ...Object.entries(SIGN_WORDS)]) {
    if (!v.includes("不必")) continue;
    const p = k.split("::")[0];
    perBu.set(p, (perBu.get(p) ?? 0) + 1);
  }
  const buOffenders = [...perBu.entries()].filter(([, c]) => c > 3);
  buOffenders.length === 0
    ? ok(`「不必」句式未塌缩（每人最多 ${Math.max(...[...perBu.values()], 0)} 条，上限 3）`)
    : no(`${buOffenders.length} 个人格「不必」超标：${buOffenders.map(([p, c]) => `${p}(${c})`).join(" ")}`);

  // ⑥ 未测用户必须回落原文案（null），且结果确定
  const sample = Object.values(PERFUMES)[0];
  getSignLine(null, sample) === null && getSignWord(null, 0) === null
    ? ok("未测人格 → 取不到文案（界面回落原描述 / 原句）")
    : no("未测人格竟然取到了文案 → 个性化会覆盖掉全员一致的版本");
  const a1 = getSignLine(perNames[0], sample);
  const a2 = getSignLine(perNames[0], sample);
  a1 !== null && a1 === a2 && getSignWord(perNames[0], 0) === getSignWord(perNames[0], 0)
    ? ok("同一（人格, 香）永远同一句（确定性，不随刷新变化）")
    : no("个性化文案不确定 → 刷新会换句子");
}

console.log(`\n══════ 结果：${pass} 通过 / ${fail} 失败 ══════`);
process.exit(fail > 0 ? 1 : 0);
