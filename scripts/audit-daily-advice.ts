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
import { checkCopy } from "@/lib/contentGuard";

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

console.log(`\n══════ 结果：${pass} 通过 / ${fail} 失败 ══════`);
process.exit(fail > 0 ? 1 : 0);
