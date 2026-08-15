/**
 * Crush香鉴 · 全量一致性审计脚本
 * 校验：16 人格结果页全部功能区块的数据对应性 / 正确性 / bug
 * 覆盖：锁定版 + 解锁版区块、朋友匹配、问卷路径→人格映射确定性
 *
 * 运行：npx tsx scripts/audit_consistency.ts
 */
import {
  PERSONALITIES,
  PERSONALITY_ID_MAP,
  PERSONALITY_NAME_MAP,
  getRecommendations,
  getRadarScores,
  getHiddenFace,
  getScentBlueprint,
  getScentAdvice,
  getPerfumeDetails,
  getContrastScent,
  getUsageGuide,
  getParseQuote,
  getUsagePhilosophy,
  getShareQuote,
  getSharePerfumeReason,
  getSimilarPersonalities,
  RADAR_DIMS,
} from '@/lib/personalities';
import { PERFUMES, PERSONALITY_TYPES, type Perfume } from '@/lib/data';
import { cosineSimilarity } from '@/lib/matchPerfumes';
import { calculateCompatibility } from '@/lib/friendMatch';
import { QUESTIONS, calculatePersonalityFromPath } from '@/lib/branchingQuestions';

type Severity = 'HIGH' | 'MEDIUM' | 'LOW';
const issues: { sev: Severity; where: string; msg: string }[] = [];
const ok = (cond: boolean, sev: Severity, where: string, msg: string) => {
  if (!cond) issues.push({ sev, where, msg });
};

const PERFUME_NAMES = Object.keys(PERFUMES);
const PERSONALITY_NAMES = PERSONALITIES.map((p) => p.name);
const PIDS = new Set(PERSONALITY_TYPES.map((t) => t.id));
const PNAMES = new Set(PERSONALITY_TYPES.map((t) => t.name));

console.log(`=== 审计开始：人格数=${PERSONALITIES.length}，香水数=${PERFUME_NAMES.length}，原型数=${PERSONALITY_TYPES.length} ===\n`);

// ─────────────────────────────────────────────────────────
// 1. 跨引用一致性：PERSONALITY_ID_MAP ↔ PERSONALITY_TYPES
// ─────────────────────────────────────────────────────────
console.log('【1】跨引用一致性（ID映射 ↔ 原型表）');
for (const p of PERSONALITIES) {
  const id = PERSONALITY_ID_MAP[p.name];
  ok(!!id, 'HIGH', `map:${p.name}`, `PERSONALITY_ID_MAP 缺少 ${p.name} 的英文 id`);
  const t = PERSONALITY_TYPES.find((x) => x.id === id);
  ok(!!t, 'HIGH', `map:${p.name}`, `PERSONALITY_TYPES 中找不到 id=${id}（映射悬空）`);
  if (t) {
    ok(t.name === p.name, 'HIGH', `map:${p.name}`, `原型 name="${t.name}" 与中文名 "${p.name}" 不一致`);
  }
}
ok(PERSONALITIES.length === 16, 'HIGH', 'PERSONALITIES', `人格数应为 16，实际 ${PERSONALITIES.length}`);
ok(PERSONALITY_TYPES.length === 16, 'HIGH', 'PERSONALITY_TYPES', `原型数应为 16，实际 ${PERSONALITY_TYPES.length}`);

// ─────────────────────────────────────────────────────────
// 2. 每人格：推荐三香完整性 + 角色 + 去重 + 悬空 + 匹配度梯度
// ─────────────────────────────────────────────────────────
console.log('【2】三香推荐（代表方案B）逐一校验');
const budgetByArch: Record<string, string> = {};
for (const p of PERSONALITIES) {
  const recs = getRecommendations(p.name);
  // 数量
  ok(recs.length === 3, 'HIGH', `rec:${p.name}`, `推荐数应为 3，实际 ${recs.length}（若为 SAMPLE 兜底说明映射缺失）`);
  // 角色分布
  const roles = { signature: 0, advanced: 0, budget: 0 } as Record<string, number>;
  recs.forEach((r) => (roles[r.role] = (roles[r.role] ?? 0) + 1));
  ok(roles.signature === 1, 'HIGH', `rec:${p.name}`, `signature 角色数应为 1，实际 ${roles.signature}`);
  ok(roles.advanced === 1, 'HIGH', `rec:${p.name}`, `advanced 角色数应为 1，实际 ${roles.advanced}`);
  ok(roles.budget === 1, 'HIGH', `rec:${p.name}`, `budget 角色数应为 1，实际 ${roles.budget}`);
  // 同名去重
  const names = recs.map((r) => r.name);
  ok(new Set(names).size === names.length, 'HIGH', `rec:${p.name}`, `三香存在重名：${names.join('/')}`);
  // 悬空品牌 / 香水存在性
  recs.forEach((r) => {
    ok(!!PERFUMES[r.name], 'HIGH', `rec:${p.name}`, `香水 "${r.name}" 在 PERFUMES 中不存在（悬空引用）`);
    ok(!!(r.brand || r.brandCn), 'MEDIUM', `rec:${p.name}`, `香水 "${r.name}" 品牌为空`);
  });
  // 匹配度梯度：本命香(85-95) ≥ 进阶香 & 尝试香
  const sig = recs.find((r) => r.role === 'signature');
  const adv = recs.find((r) => r.role === 'advanced');
  const bud = recs.find((r) => r.role === 'budget');
  if (sig) {
    ok(sig.match >= 85 && sig.match <= 95, 'MEDIUM', `rec:${p.name}`, `本命香匹配度应在 85-95，实际 ${sig.match}`);
    if (adv) ok(sig.match >= adv.match, 'HIGH', `rec:${p.name}`, `本命香(${sig.match}) < 进阶香(${adv.match}) 梯度倒挂`);
    if (bud) ok(sig.match >= bud.match, 'HIGH', `rec:${p.name}`, `本命香(${sig.match}) < 尝试香(${bud.match}) 梯度倒挂`);
  }
  if (bud) budgetByArch[p.name] = bud.name;
}

// 平价档全局去重：16 人格应各拿一支互不重复的尝试香
const budgetVals = Object.values(budgetByArch);
ok(new Set(budgetVals).size === budgetVals.length, 'HIGH', 'budget-dedup', `平价档尝试香未全局去重，重复数=${budgetVals.length - new Set(budgetVals).size}：${budgetVals.join(' / ')}`);

// ─────────────────────────────────────────────────────────
// 3. getPerfumeDetails（解锁版本命香完整档案）一致性
// ─────────────────────────────────────────────────────────
console.log('【3】解锁版本命香档案 getPerfumeDetails');
for (const p of PERSONALITIES) {
  const details = getPerfumeDetails(p.name);
  ok(details.length === 3, 'HIGH', `detail:${p.name}`, `PerfumeDetail 数应为 3，实际 ${details.length}`);
  const recs = getRecommendations(p.name);
  details.forEach((d, i) => {
    ok(Array.isArray(d.top) && d.top.length > 0, 'MEDIUM', `detail:${p.name}`, `第${i + 1}支 top 三调为空`);
    ok(Array.isArray(d.heart) && d.heart.length > 0, 'MEDIUM', `detail:${p.name}`, `第${i + 1}支 heart 三调为空`);
    ok(Array.isArray(d.base) && d.base.length > 0, 'MEDIUM', `detail:${p.name}`, `第${i + 1}支 base 三调为空`);
    const rec = recs[i];
    if (rec) {
      ok(d.name === rec.name, 'MEDIUM', `detail:${p.name}`, `PerfumeDetail 顺序与推荐不一致：${d.name} vs ${rec.name}`);
      ok(d.role === rec.role, 'MEDIUM', `detail:${p.name}`, `PerfumeDetail role 不一致：${d.role} vs ${rec.role}`);
    }
  });
}

// ─────────────────────────────────────────────────────────
// 4. 静态字典完整性（隐藏人格面 / 气味底稿 / 气味建议）
// ─────────────────────────────────────────────────────────
console.log('【4】解锁版静态字典完整性');
for (const p of PERSONALITIES) {
  const hf = getHiddenFace(p.name);
  const hfFallback = getHiddenFace('暗流');
  ok(!!hf.title && !!hf.content && Array.isArray(hf.traits) && hf.traits.length > 0, 'MEDIUM', `hidden:${p.name}`, `隐藏人格面字段缺失/降级到暗流兜底`);
  // 用 content（各人格独有）而非 title（所有人格同为「表象之下的你」）判断是否误用兜底
  ok(p.name === '暗流' || hf.content !== hfFallback.content, 'LOW', `hidden:${p.name}`, `隐藏人格面 content 疑似误用暗流兜底`);
  const bp = getScentBlueprint(p.name);
  ok(!!bp.top && !!bp.heart && !!bp.base && !!bp.signature, 'MEDIUM', `blueprint:${p.name}`, `气味底稿字段缺失/降级`);
  const sa = getScentAdvice(p.name);
  ok(!!sa.relationAdvice && !!sa.dating && !!sa.office && !!sa.travel && !!sa.explore1 && !!sa.explore2, 'MEDIUM', `advice:${p.name}`, `气味建议字段缺失/降级`);
}

// ─────────────────────────────────────────────────────────
// 5. 反差香（全量去重）
// ─────────────────────────────────────────────────────────
console.log('【5】反差香 getContrastScent');
const contrastNames: string[] = [];
for (const p of PERSONALITIES) {
  const c = getContrastScent(p.name);
  ok(!!PERFUMES[c.name], 'HIGH', `contrast:${p.name}`, `反差香 "${c.name}" 悬空`);
  ok(!!(c.brand), 'MEDIUM', `contrast:${p.name}`, `反差香品牌为空`);
  ok(!!c.why, 'MEDIUM', `contrast:${p.name}`, `反差香 why 文案为空`);
  contrastNames.push(c.name);
}
ok(new Set(contrastNames).size === contrastNames.length, 'MEDIUM', 'contrast-dedup', `反差香未全局去重，重复=${contrastNames.length - new Set(contrastNames).size}`);

// ─────────────────────────────────────────────────────────
// 6. 用香指南 4 场景
// ─────────────────────────────────────────────────────────
console.log('【6】用香指南 getUsageGuide');
for (const p of PERSONALITIES) {
  const g = getUsageGuide(p.name);
  ok(g.length === 4, 'MEDIUM', `guide:${p.name}`, `用香指南场景数应为 4，实际 ${g.length}`);
  g.forEach((t) => ok(!!t.scene && !!t.text && !!t.icon, 'MEDIUM', `guide:${p.name}`, `场景卡片字段缺失`));
}

// ─────────────────────────────────────────────────────────
// 7. 解析金句 / 用香哲学（B1 按人格变体）
// ─────────────────────────────────────────────────────────
console.log('【7】解析金句 / 用香哲学（B1）');
for (const p of PERSONALITIES) {
  const pq = getParseQuote(p.name);
  ok(!!pq && !pq.includes('undefined'), 'MEDIUM', `parseQuote:${p.name}`, `解析金句异常：${pq}`);
  ok(pq.includes(p.tagline), 'LOW', `parseQuote:${p.name}`, `解析金句未包含该人格 tagline（变体疑似失效）`);
  const up = getUsagePhilosophy(p.name);
  ok(!!up && !up.includes('undefined'), 'MEDIUM', `usagePhil:${p.name}`, `用香哲学异常：${up}`);
}

// ─────────────────────────────────────────────────────────
// 8. 分享图文案资产
// ─────────────────────────────────────────────────────────
console.log('【8】分享图资产（金句/本命香理由/同类）');
for (const p of PERSONALITIES) {
  ok(!!getShareQuote(p.name), 'LOW', `shareQuote:${p.name}`, `分享金句为空`);
  ok(!!getSharePerfumeReason(p.name), 'LOW', `shareReason:${p.name}`, `本命香理由为空`);
  const sim = getSimilarPersonalities(p.name);
  ok(Array.isArray(sim) && sim.length === 3, 'LOW', `similar:${p.name}`, `同类 top3 数量异常：${sim?.length}`);
}

// ─────────────────────────────────────────────────────────
// 9. 雷达分值有效性
// ─────────────────────────────────────────────────────────
console.log('【9】雷达分值 getRadarScores');
for (const p of PERSONALITIES) {
  const r = getRadarScores(p.name);
  let valid = true;
  for (const dim of RADAR_DIMS) {
    const v = r[dim];
    if (typeof v !== 'number' || !isFinite(v) || v < 0 || v > 1) valid = false;
  }
  ok(valid, 'HIGH', `radar:${p.name}`, `雷达分值非法：${JSON.stringify(r)}`);
}

// ─────────────────────────────────────────────────────────
// 10. 朋友匹配 16×16
// ─────────────────────────────────────────────────────────
console.log('【10】朋友匹配 calculateCompatibility（16×16）');
const GRADES = new Set(['灵魂伴侣', '天生一对', '互补有趣', '各有所爱', '气质迥异']);
let friendPairs = 0;
let nonDet = 0;
for (let i = 0; i < PERSONALITY_TYPES.length; i++) {
  for (let j = 0; j < PERSONALITY_TYPES.length; j++) {
    const me = PERSONALITY_TYPES[i];
    const fr = PERSONALITY_TYPES[j];
    const r = calculateCompatibility(me, fr);
    friendPairs++;
    ok(Number.isFinite(r.score) && r.score >= 0 && r.score <= 100, 'HIGH', `friend:${me.name}→${fr.name}`, `匹配度越界：${r.score}`);
    ok(GRADES.has(r.grade), 'MEDIUM', `friend:${me.name}→${fr.name}`, `评级非法：${r.grade}`);
    ok(Array.isArray(r.sharedNotes), 'MEDIUM', `friend:${me.name}→${fr.name}`, `sharedNotes 非数组`);
    ok(typeof r.complement === 'string' && r.complement.length > 0, 'MEDIUM', `friend:${me.name}→${fr.name}`, `complement 为空`);
    ok(typeof r.story === 'string' && r.story.length > 0, 'MEDIUM', `friend:${me.name}→${fr.name}`, `story 为空`);
    ok(typeof r.shareText === 'string' && r.shareText.includes(String(r.score)), 'MEDIUM', `friend:${me.name}→${fr.name}`, `shareText 不含分数`);
    ok(r.compareScores && [r.compareScores.floral, r.compareScores.woody, r.compareScores.fresh, r.compareScores.oriental, r.compareScores.citrus, r.compareScores.gourmand].every((n) => Number.isFinite(n)), 'MEDIUM', `friend:${me.name}→${fr.name}`, `compareScores 非法`);
    // 确定性：同输入两次调用
    const r2 = calculateCompatibility(me, fr);
    if (JSON.stringify(r) !== JSON.stringify(r2)) nonDet++;
  }
}
ok(nonDet === 0, 'HIGH', 'friend-determinism', `朋友匹配存在非确定性结果 ${nonDet} 例`);

// ─────────────────────────────────────────────────────────
// 11. 问卷路径→人格映射：确定性 + 覆盖
// ─────────────────────────────────────────────────────────
console.log('【11】问卷路径→人格映射（确定性 + 覆盖）');

// 遍历 branching tree，收集所有叶子路径（choice id 序列）
const nextIds = new Set<string>();
Object.values(QUESTIONS).forEach((q) => q.choices.forEach((c) => c.nextQuestionId && nextIds.add(c.nextQuestionId)));
const roots = Object.keys(QUESTIONS).filter((qid) => !nextIds.has(qid));
const paths: string[][] = [];
const dfs = (qid: string, acc: string[]) => {
  const q = QUESTIONS[qid];
  if (!q) return;
  if (!q.choices || q.choices.length === 0) { paths.push(acc); return; }
  let anyNext = false;
  for (const c of q.choices) {
    if (c.nextQuestionId && QUESTIONS[c.nextQuestionId]) {
      anyNext = true;
      dfs(c.nextQuestionId, [...acc, c.id]);
    } else {
      paths.push([...acc, c.id]);
    }
  }
  if (!anyNext) paths.push(acc);
};
roots.forEach((r) => dfs(r, []));
console.log(`    问卷叶子路径总数 = ${paths.length}，根 = ${roots.join(',')}`);
ok(paths.length > 0, 'HIGH', 'paths', `未枚举到任何问卷路径`);

// 确定性：每条路径重复调用 5 次，检测 personalityId 是否变化
let detFlips = 0;
const flipSamples: string[] = [];
for (const path of paths) {
  const first = calculatePersonalityFromPath(path);
  const ids = [first.personalityId];
  for (let k = 1; k < 5; k++) ids.push(calculatePersonalityFromPath(path).personalityId);
  const uniq = new Set(ids);
  if (uniq.size > 1) {
    detFlips++;
    if (flipSamples.length < 5) flipSamples.push(`路径[${path.join(',')}] → ${[...uniq].join('/')}`);
  }
}
ok(detFlips === 0, 'HIGH', 'path-determinism', `问卷映射非确定：有 ${detFlips}/${paths.length} 条路径重复调用返回不同人格！示例：${flipSamples.join(' | ')}`);

// 覆盖：用「实际路由」(生产调用 calculatePersonalityFromPath) 判断每个原型是否可达
// 注意：路由层已用确定性分配表保证 16 原型全覆盖（部分路径被贪心借给原生余弦次近的原型），
// 因此此处必须检验真实路由函数，而非独立重算纯余弦（否则会把设计性借路径误报为缺口）
const reachable = new Set<string>();
for (const path of paths) {
  reachable.add(calculatePersonalityFromPath(path).personalityId);
}
const unreachable = [...PIDS].filter((id) => !reachable.has(id));
ok(unreachable.length === 0, 'MEDIUM', 'path-coverage', `问卷路径无法映射到以下原型（覆盖缺口）：${unreachable.join(', ')}`);
// 实际路由分布（展示每个原型被多少条路径命中）
const dist: Record<string, number> = {};
for (const path of paths) {
  const pid = calculatePersonalityFromPath(path).personalityId;
  dist[pid] = (dist[pid] ?? 0) + 1;
}
const distStr = PERSONALITY_TYPES.map((t) => `${t.name}:${dist[t.id] ?? 0}`).join('  ');
console.log(`    实际路由分布（确定性分配表）：\n    ${distStr}`);

// ─────────────────────────────────────────────────────────
// 汇总
// ─────────────────────────────────────────────────────────
console.log(`\n=== 审计汇总 ===`);
const bySev: Record<Severity, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
issues.forEach((i) => bySev[i.sev]++);
console.log(`人格数=${PERSONALITIES.length} 朋友配对=${friendPairs} 问卷路径=${paths.length}`);
console.log(`问题统计：HIGH=${bySev.HIGH}  MEDIUM=${bySev.MEDIUM}  LOW=${bySev.LOW}  合计=${issues.length}`);
if (issues.length) {
  console.log('\n--- 问题清单 ---');
  for (const sev of ['HIGH', 'MEDIUM', 'LOW'] as Severity[]) {
    const list = issues.filter((i) => i.sev === sev);
    if (!list.length) continue;
    console.log(`\n[${sev}] (${list.length})`);
    list.slice(0, 60).forEach((i) => console.log(`  • ${i.where}: ${i.msg}`));
    if (list.length > 60) console.log(`  … 其余 ${list.length - 60} 条省略`);
  }
} else {
  console.log('✅ 全部通过，未发现数据对应性 / 正确性问题。');
}
