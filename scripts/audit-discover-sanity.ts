// 探索页（A 组）与推荐链路的健全性自检。
// 重点怀疑点：lib/discover.ts 用 PERFUMES[香水名] 反查，
// 若香水库的「键」与 Perfume.name 不一致，反查全部落空 → 场景选香 / 以香搜人静默失效。
import { PERFUMES, PERSONALITY_TYPES, type Perfume } from "../lib/data";
import { getCalibratedRecommendations } from "../lib/matchPerfumes";
import {
  findPersonalitiesByPerfume,
  searchPerfumes,
  pickPerfumeForScene,
  findPerfume,
  SCENE_OPTIONS,
} from "../lib/discover";

const pass: string[] = [];
const fail: string[] = [];
const warn: string[] = [];
const ck = (cond: boolean, label: string, detail = "") => {
  (cond ? pass : fail).push(`${cond ? "✅" : "❌"} ${label}${detail ? "  — " + detail : ""}`);
};

const all = Object.entries(PERFUMES) as [string, Perfume][];
console.log("香水总数 =", all.length);

// ── 1. 键 与 name 是否一致 ──────────────────────────────
const mismatch = all.filter(([key, p]) => key !== p.name);
console.log("\n=== 1. 香水库 key vs Perfume.name ===");
console.log(`不一致数量 = ${mismatch.length} / ${all.length}`);
mismatch.slice(0, 20).forEach(([k, p]) => console.log(`   key=${k}   name=${p.name}`));
// 这是**数据事实**，不是缺陷：改 key 会让已冻结的日签快照（lib/daily/pool.ts）
// 里的 id 失配，导致历史签漂移。正确做法是保留 key、在查找层做兼容（见 findPerfume）。
if (mismatch.length > 0) {
  warn.push(`⚠️ 香水库有 ${mismatch.length} 支 key≠name（已知数据事实，不修 key 以免日签漂移）`);
} else {
  pass.push("✅ 香水库 key 与 name 完全一致");
}

// 关键：虽然 key≠name，但「按 key 查」与「按 name 查」必须都能命中
const bothOk = mismatch.every(([k, p]) => !!findPersonalitiesByPerfume(k, 3).length &&
                                          !!findPersonalitiesByPerfume(p.name, 3).length);
ck(bothOk, "key≠name 的香水两种查法都能命中（兼容层生效）");

// name 反查命中率
const byName = new Map(all.map(([, p]) => [p.name, p]));
ck(byName.size === all.length, "name 唯一（无重名覆盖）",
   `name 去重后 ${byName.size} / ${all.length}`);

// ── 2. 校准题组合是否合法（探索页写死了 cal1b/cal2b/cal3b）────
console.log("\n=== 2. 探索页默认校准组合 ===");
const radar = { floral: 0.5, woody: 0.5, fresh: 0.5, oriental: 0.5, citrus: 0.5, gourmand: 0.5 };
const recs = getCalibratedRecommendations(radar, ["cal1b", "cal2b", "cal3b"], [], undefined, false);
console.log("默认组合返回条数 =", recs.length);
ck(recs.length > 0, "探索页默认校准组合能产出推荐",
   recs.length ? recs.map((r) => `${r.role}:${r.name}`).join(", ") : "返回空数组 → 页面会空白");

// ── 3. 场景选香：能否真正按场景区分 ──────────────────────
console.log("\n=== 3. 场景选香 ===");
if (recs.length > 0) {
  const picks = SCENE_OPTIONS.map((s) => ({ scene: s.label, r: pickPerfumeForScene(recs, s.key) }));
  picks.forEach((p) => console.log(`   ${p.scene}: ${p.r?.name ?? "null"}  (${p.r?.reason ?? "-"})`));
  const names = picks.map((p) => p.r?.name);
  ck(names.every((n) => !!n), "所有场景都返回了香水名");
  ck(new Set(names).size > 1, "不同场景能选出不同的香",
     `5 个场景只选出 ${new Set(names).size} 种 → ${new Set(names).size === 1 ? "排序完全失效" : ""}`);
  const generic = picks.filter((p) => p.r?.reason === "与你的人格底色最贴合").length;
  ck(generic < picks.length, "场景理由不是全部兜底文案",
     `${generic}/${picks.length} 个场景落到兜底文案`);

  // 品牌必须由候选带回（不再反查香水库，避免 key≠name 时品牌显示为空）
  const noBrand = picks.filter((p) => !(p.r?.brandCn || p.r?.brand));
  ck(noBrand.length === 0, "场景选香带回品牌信息",
     `${noBrand.length} 个场景品牌为空 → ${noBrand.map((p) => p.r?.name).join(",")}`);
}

// 用「全部 225 支」验证：场景排序是否真的有区分力（而非只靠兜底）
const sample = Object.values(PERFUMES).slice(0, 40) as Perfume[];
const samplePicks = new Set(SCENE_OPTIONS.map((s) => pickPerfumeForScene(sample, s.key)?.name));
ck(samplePicks.size > 1, "大候选池下场景选香仍有区分力", `选出 ${samplePicks.size} 种`);

// ── 4. 以香搜人 ──────────────────────────────────────────
console.log("\n=== 4. 以香搜人 ===");
const probe = all.slice(0, 5);
for (const [key, p] of probe) {
  const byKey = findPersonalitiesByPerfume(key, 3);
  const byNameQ = findPersonalitiesByPerfume(p.name, 3);
  console.log(`   ${key} → key查:${byKey.length} 条 / name查:${byNameQ.length} 条` +
    (byKey.length ? `  首选=${byKey[0].name}(${byKey[0].match})` : ""));
}
const emptyByKey = all.filter(([k]) => findPersonalitiesByPerfume(k, 3).length === 0);
ck(emptyByKey.length === 0, "任意香水都能反查到人格",
   `${emptyByKey.length} 支反查为空`);

const emptyByName = all.filter(([, p]) => findPersonalitiesByPerfume(p.name, 3).length === 0);
ck(emptyByName.length === 0, "用 Perfume.name 反查也能命中",
   `${emptyByName.length} 支用 name 查不到`);

// 匹配度数值范围
const someRes = findPersonalitiesByPerfume(all[0][0], 3);
ck(someRes.every((r) => r.match >= 0 && r.match <= 100), "契合度落在 0-100");
ck(someRes.every((r) => !!r.name && !!r.tagline), "人格名与 tagline 非空");

// 非法输入
ck(findPersonalitiesByPerfume("不存在的香水名", 3).length === 0, "非法香水名安全返回空");

// ── 5. 搜索 ──────────────────────────────────────────────
console.log("\n=== 5. 香水搜索 ===");
console.log("   空关键字返回 =", searchPerfumes("", 24).length);
console.log("   「玫瑰」命中 =", searchPerfumes("玫瑰", 24).length);
console.log("   「zzz」命中 =", searchPerfumes("zzz", 24).length);
ck(searchPerfumes("", 24).length > 0, "空关键字有默认列表");
ck(searchPerfumes("zzz", 24).length === 0, "无命中时返回空而非全部");

// ── 6. 16 人格推荐完整性（地基④ 回归）────────────────────
console.log("\n=== 6. 16 人格推荐完整性 ===");
type PLite = { id: string; name: string; radarScores: Record<string, number> };
const types = PERSONALITY_TYPES as unknown as PLite[];
console.log("人格数 =", types.length);
let bad = 0, dup = 0, budgetWrong = 0;
for (const t of types) {
  const vec = {
    floral: (t.radarScores.floral ?? 50) / 100,
    woody: (t.radarScores.woody ?? 50) / 100,
    fresh: (t.radarScores.fresh ?? 50) / 100,
    oriental: (t.radarScores.oriental ?? 50) / 100,
    citrus: (t.radarScores.citrus ?? 50) / 100,
    gourmand: (t.radarScores.gourmand ?? 50) / 100,
  } as never;
  // canonical 视图（原型锁 16 支）
  const canon = getCalibratedRecommendations(vec, ["cal1b", "cal2b", "cal3b"], [], t.id, true);
  // 真实用户路径
  const real = getCalibratedRecommendations(vec, ["cal1b", "cal2b", "cal3b"], [], t.id, false);
  for (const [tag, rs] of [["canonical", canon], ["real", real]] as const) {
    if (rs.length < 2) { bad++; console.log(`   ❌ ${t.name}/${tag} 仅 ${rs.length} 条`); }
    if (rs.some((r) => !r.name || !r.brand)) { bad++; console.log(`   ❌ ${t.name}/${tag} 存在空字段`); }
    const nm = rs.map((r) => r.name);
    if (new Set(nm).size !== nm.length) { dup++; console.log(`   ⚠️  ${t.name}/${tag} 推荐重复: ${nm.join(",")}`); }
    const b = rs.find((r) => r.role === "budget");
    if (b && (PERFUMES as Record<string, Perfume>)[b.name]?.tier !== "budget") {
      budgetWrong++;
      console.log(`   ⚠️  ${t.name}/${tag} budget 档不是平价: ${b.name}`);
    }
  }
}
ck(bad === 0, "16 人格 × 两条路径推荐均完整", `${bad} 处异常`);
ck(dup === 0, "推荐无重复", `${dup} 处重复`);
ck(budgetWrong === 0, "budget 档确实为平价香", `${budgetWrong} 处越档`);

// ── 7. 缓存一致性：同参数重复调用结果稳定 ─────────────────
const a1 = getCalibratedRecommendations(radar, ["cal1b", "cal2b", "cal3b"], [], types[0].id, true);
const a2 = getCalibratedRecommendations(radar, ["cal1b", "cal2b", "cal3b"], [], types[0].id, true);
ck(JSON.stringify(a1.map(r=>r.name)) === JSON.stringify(a2.map(r=>r.name)),
   "重复调用结果稳定（缓存无副作用）");

// ── 输出 ────────────────────────────────────────────────
console.log("\n\n════════ 结果 ════════");
pass.forEach((l) => console.log(l));
warn.forEach((l) => console.log(l));
fail.forEach((l) => console.log(l));
console.log(`\n通过 ${pass.length} / 失败 ${fail.length} / 提醒 ${warn.length}`);
