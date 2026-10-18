// ============================================================
// Crush香鉴 — 香水匹配引擎 (18 维向量重构)
// 基于用户 6 维香调偏好向量 × 香水 18 维调香结构（前/中/后调各 6 维），
// 分阶段余弦相似度加权，对所有香水做精准重排，挑 topN
// ============================================================

import { PERFUMES, PERSONALITY_TYPES, type Perfume } from "./data";
import { getPerfumeSemantics } from "./data/perfumeSemantics";
import type { Texture } from "./data/noteSemantics";

export interface ScentVector {
  floral: number;
  woody: number;
  fresh: number;
  oriental: number;
  citrus: number;
  gourmand: number;
  [key: string]: number;
}

/** 18 维香调结构：前调 + 中调 + 后调，各 6 维 */
export interface ScentProfile18D {
  top: ScentVector;
  heart: ScentVector;
  base: ScentVector;
}

export const DIMENSIONS: (keyof ScentVector)[] = [
  "floral",
  "woody",
  "fresh",
  "oriental",
  "citrus",
  "gourmand",
];

/** 18 维各阶段权重（前调 0.20 + 中调 0.35 + 后调 0.45）*/
const PHASE_WEIGHTS = { top: 0.20, heart: 0.35, base: 0.45 } as const;

/** 用户雷达向量中文键 → 英文键（与 DIMENSIONS / notesToVector 输出对齐）
 *  getRadarScores() 在 lib/personalities.ts 中使用 `木质/清新/东方/美食/柑橘/花香` 中文键，
 *  但本模块的向量运算全部以英文键 (floral/woody/...) 为准；不转换会得到 NaN，导致匹配度全崩。*/
const RADAR_CN_TO_EN: Record<string, keyof ScentVector> = {
  花香: 'floral',
  木质: 'woody',
  清新: 'fresh',
  东方: 'oriental',
  柑橘: 'citrus',
  美食: 'gourmand',
};

function normalizeRadarToEn(radar: Record<string, number>): ScentVector {
  const out: ScentVector = { floral: 0, woody: 0, fresh: 0, oriental: 0, citrus: 0, gourmand: 0 };
  for (const k of Object.keys(radar)) {
    const en = RADAR_CN_TO_EN[k] ?? (k as keyof ScentVector);
    if (out[en] === undefined) continue; // 防御未知键
    out[en] = radar[k];
  }
  return out;
}

// 香料关键词 → 香调维度（一个香料可命中多个维度，这里取主维度）
export const INGREDIENT_MAP: Record<string, keyof ScentVector> = {
  // 花香
  玫瑰: "floral", 茉莉: "floral", 晚香玉: "floral", 紫罗兰: "floral",
  鸢尾: "floral", 桂花: "floral", 铃兰: "floral", 鸡蛋花: "floral",
  依兰: "floral", 橙花: "floral", 牡丹: "floral", 樱花: "floral",
  百合: "floral", 小苍兰: "floral", 风信子: "floral", 康乃馨: "floral",
  花瓣: "floral", 兰花: "floral", 荷花: "floral", 木兰: "floral",
  // 木质
  雪松: "woody", 檀香: "woody", 广藿香: "woody", 岩兰草: "woody",
  橡木: "woody", 柏木: "woody", 杉木: "woody", 沉木: "woody",
  香根草: "woody", 愈创木: "woody", 竹子: "woody", 木质: "woody",
  松: "woody", 威士忌: "woody", 檀木: "woody", 木: "woody",
  // 清新
  海盐: "fresh", 薄荷: "fresh", 青草: "fresh", 雨苔: "fresh",
  臭氧: "fresh", 青苹果: "fresh", 鼠尾草: "fresh", 海风: "fresh",
  海水: "fresh", 苔藓: "fresh", 青苔: "fresh", 绿叶: "fresh",
  无花果: "fresh", 茶叶: "fresh", 白茶: "fresh", 海洋: "fresh",
  西瓜: "fresh", 黄瓜: "fresh", 罗勒: "fresh", 薄荷脑: "fresh",
  海: "fresh",
  // 东方调
  沉香: "oriental", 没药: "oriental", 琥珀: "oriental", 乳香: "oriental",
  焚香: "oriental", 香料: "oriental", 肉桂: "oriental", 黑香草: "oriental",
  烟熏: "oriental", 皮革: "oriental", 安息香: "oriental", 树脂: "oriental",
  龙涎香: "oriental", 麝香: "oriental", 姜: "oriental", 丁香: "oriental",
  肉豆蔻: "oriental", 孜然: "oriental", 烟草: "oriental", 香草根: "oriental",
  // 柑橘
  柠檬: "citrus", 青柠: "citrus", 佛手柑: "citrus", 香橙: "citrus",
  葡萄柚: "citrus", 柑橘: "citrus", 橙: "citrus", 柠檬草: "citrus",
  马鞭草: "citrus", 柚子: "citrus", 香柠檬: "citrus", 橙花油: "citrus",
  // 美食调
  香草: "gourmand", 焦糖: "gourmand", 可可: "gourmand", 蜂蜜: "gourmand",
  椰奶: "gourmand", 奶油: "gourmand", 杏仁: "gourmand", 巧克力: "gourmand",
  咖啡: "gourmand", 糖: "gourmand", 椰子: "gourmand", 饼干: "gourmand",
  太妃: "gourmand", 牛奶: "gourmand", 棉花糖: "gourmand", 桃子: "gourmand",
  杏: "gourmand",
  荔枝: "gourmand", 莓果: "gourmand", 椰: "gourmand",
  // ─── 扩容补充（常见香料，支撑 ~80→200 库）───
  // 花香
  栀子: "floral", 洋甘菊: "floral", 含笑: "floral", 金合欢: "floral",
  夜来香: "floral", 紫丁香: "floral", 山茶: "floral", 风铃草: "floral",
  芙蓉: "floral", 芍药: "floral", 蔷薇: "floral", 嫩芽: "floral",
  白花: "floral", 黄葵: "floral", 老鹳草: "floral", 山梅花: "floral", 天竺葵: "floral", 秋葵子: "floral",
  // 清新
  无花果叶: "fresh", 青柠叶: "fresh", 薄荷叶: "fresh", 尤加利: "fresh",
  桉树: "fresh", 海藻: "fresh", 矿物: "fresh", 金属: "fresh", 海雾: "fresh",
  绿茶: "fresh", 红茶: "fresh", 乌龙茶: "fresh", 青藤: "fresh", 胡荽: "fresh",
  迷迭香: "fresh", 百里香: "fresh", 紫苏: "fresh", 梨: "fresh", 黑加仑: "fresh",
  苹果: "fresh", 覆盆子: "fresh", 蓝莓: "fresh", 菠萝: "fresh", 芒果: "fresh",
  百香果: "fresh", 香橼: "fresh", 橙叶: "fresh", 柠檬皮: "fresh", 柠檬马鞭草: "fresh",
  青柠皮: "fresh", 松针: "fresh",
  冰片: "fresh", 茶: "fresh", 粉红胡椒: "fresh", 黑醋栗: "fresh", 黑醋栗叶: "fresh",
  马黛茶: "fresh", 醛类: "fresh", 薰衣草: "fresh", 亚麻: "fresh", 莲花: "fresh",
  // 木质
  冷杉: "woody", 云杉: "woody", 香柏: "woody", 雪松木: "woody",
  树皮: "woody", 木芯: "woody", 松木: "woody", 树枝: "woody", 纸莎草: "woody",
  // 东方
  麂皮: "oriental", 绒面: "oriental", 红酒: "oriental", 朗姆: "oriental",
  辛料: "oriental", 八角: "oriental", 小豆蔻: "oriental", 茴香: "oriental",
  芫荽籽: "oriental", 当归: "oriental", 鸢尾根: "oriental", 木烟: "oriental",
  烟斗: "oriental", 焚香木: "oriental", 藏红花: "oriental", 葛缕子: "oriental", 胡椒: "oriental", 劳丹脂: "oriental",
  // 柑橘
  柠檬皮油: "citrus", 葡萄柚皮: "citrus",
  // 美食
  榛子: "gourmand", 核桃: "gourmand", 大米: "gourmand", 草莓: "gourmand",
  树莓: "gourmand", 黑加仑果: "gourmand", 枫糖: "gourmand", 甘草: "gourmand",
  果酱: "gourmand", 威化: "gourmand", 布丁: "gourmand", 柿: "gourmand",
  哈密瓜: "gourmand", 蜜瓜: "gourmand", 焦糖布丁: "gourmand", 零陵香豆: "gourmand",
  // ─── 高定线补充 ───
  // 木质
  橡木苔: "woody", 丝柏: "woody",
  // 清新
  杜松子: "fresh",
  // 东方
  苏合香: "oriental", 朗姆酒: "oriental", 干邑: "oriental",
  // 花香
  天芥菜: "floral",
};

const profileCache = new Map<string, ScentVector>();
const profile18DCache = new Map<string, ScentProfile18D>();

// 由一个 notes 数组推导 6 维向量
function notesToVector(notes: string[]): ScentVector {
  const v: ScentVector = {
    floral: 0, woody: 0, fresh: 0, oriental: 0, citrus: 0, gourmand: 0,
  };
  for (const note of notes) {
    for (const kw of Object.keys(INGREDIENT_MAP)) {
      if (note.includes(kw)) {
        v[INGREDIENT_MAP[kw]] += 1;
      }
    }
  }
  return v;
}

// 由香水 notes（前/中/后调）推导 6 维向量（向后兼容）
export function getPerfumeProfile(perfume: Perfume): ScentVector {
  const cached = profileCache.get(perfume.id);
  if (cached) return cached;

  const v = notesToVector([
    ...perfume.notes.top,
    ...perfume.notes.heart,
    ...perfume.notes.base,
  ]);

  profileCache.set(perfume.id, v);
  return v;
}

/**
 * 归一化到 0~1 的 6 维气味光谱（雷达图 / 可视化专用）
 *
 * ⚠️ 注意区分：getPerfumeProfile 返回的是**原始计数**（每命中一个香材关键词 +1，
 * 量级 0~N），直接喂给雷达图会让多边形飞出 viewBox、整张分享图错位。
 * 可视化一律用本函数（按该支香自身的最大值归一，保留形状）。
 */
export function getPerfumeProfileNorm(perfume: Perfume): ScentVector {
  const v = getPerfumeProfile(perfume);
  const max = Math.max(1, v.floral, v.woody, v.fresh, v.oriental, v.citrus, v.gourmand);
  return {
    floral: v.floral / max,
    woody: v.woody / max,
    fresh: v.fresh / max,
    oriental: v.oriental / max,
    citrus: v.citrus / max,
    gourmand: v.gourmand / max,
  };
}

// 由香水 notes 推导 18 维向量（前/中/后调各 6 维）
export function getPerfumeProfile18D(perfume: Perfume): ScentProfile18D {
  const cached = profile18DCache.get(perfume.id);
  if (cached) return cached;

  const profile: ScentProfile18D = {
    top: notesToVector(perfume.notes.top),
    heart: notesToVector(perfume.notes.heart),
    base: notesToVector(perfume.notes.base),
  };

  profile18DCache.set(perfume.id, profile);
  return profile;
}

// 余弦相似度（方向敏感，尺度无关）
export function cosineSimilarity(a: ScentVector, b: ScentVector): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (const d of DIMENSIONS) {
    dot += a[d] * b[d];
    na += a[d] * a[d];
    nb += b[d] * b[d];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * 18 维分阶段相似度：用户 6 维向量 × 香水 18 维结构
 * 用户向量分别与香水的前调/中调/后调向量做余弦相似度，
 * 再按 PHASE_WEIGHTS 加权求和（前调 0.20 + 中调 0.35 + 后调 0.45）
 * 这比原来混合所有调的一团 6 维向量更精准：
 * - 前调差异大的香水（如柑橘开场 vs 花香开场）会被区分开
 * - 后调权重最高，因为后调决定了“留在皮肤上的最后印象”
 */
export function cosineSimilarity18D(userVec: ScentVector, perfumeProfile: ScentProfile18D): number {
  const topSim = cosineSimilarity(userVec, perfumeProfile.top);
  const heartSim = cosineSimilarity(userVec, perfumeProfile.heart);
  const baseSim = cosineSimilarity(userVec, perfumeProfile.base);
  return (
    topSim * PHASE_WEIGHTS.top +
    heartSim * PHASE_WEIGHTS.heart +
    baseSim * PHASE_WEIGHTS.base
  );
}

// 对所有香水重排，返回相似度最高的 n 支
export function getTopPerfumes(
  userVector: ScentVector,
  n = 3,
): Perfume[] {
  const scored = Object.values(PERFUMES).map((p) => ({
    perfume: p,
    score: cosineSimilarity(userVector, getPerfumeProfile(p)),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, n).map((s) => s.perfume);
}

// ════════════════════════════════════════════════════════
// 校准匹配算法：基于 cal1/cal2/cal3 用户偏好 + 雷达图，从 225 支香水库动态推荐
// ════════════════════════════════════════════════════════

/** 校准选择 → 香水属性映射 */
interface CalPreferences {
  scentStyle: 'sweet' | 'clean' | 'deep';   // cal1 气息偏向
  longevityPref: 'long' | 'medium' | 'light'; // cal2 留香偏好
  occasion: 'solo' | 'daytime' | 'date';    // cal3 使用场景
  // ── P1（2026-10-19）新增三道校准题 ──
  // null = 该用户没答过这题（老用户只有 3 条校准答案 / canonical 原型视图）。
  // null 时对应评分函数必须返回常数 50，使新增项对所有香水的调整量恒为 0
  // → 老结果与 16 原型 canonical 视图逐位不变，零历史漂移。
  avoid: 'sweet' | 'floral' | 'woody' | 'none' | null;  // cal4 雷区
  season: 'summer' | 'winter' | 'any' | null;           // cal5 季节/温度
  budget: 'low' | 'mid' | 'high' | null;                // cal6 预算
}

/** 从校准答案 choiceId 解析偏好 */
function parseCalPreferences(calChoices: string[]): CalPreferences | null {
  // cal1: cal1a=甜润温柔, cal1b=清冽干净, cal1c=深沉有故事
  const scentMap: Record<string, CalPreferences['scentStyle']> = {
    cal1a: 'sweet', cal1b: 'clean', cal1c: 'deep',
  };
  // cal2: cal2a=持久, cal2b=适中, cal2c=清淡
  const longevityMap: Record<string, CalPreferences['longevityPref']> = {
    cal2a: 'long', cal2b: 'medium', cal2c: 'light',
  };
  // cal3: cal3a=独处深夜, cal3b=白天出门, cal3c=约会重要场合
  const occasionMap: Record<string, CalPreferences['occasion']> = {
    cal3a: 'solo', cal3b: 'daytime', cal3c: 'date',
  };
  // cal4: cal4a=避雷甜腻美食调, cal4b=避雷厚重白花, cal4c=避雷烟熏重木, cal4d=都不排斥
  const avoidMap: Record<string, NonNullable<CalPreferences['avoid']>> = {
    cal4a: 'sweet', cal4b: 'floral', cal4c: 'woody', cal4d: 'none',
  };
  // cal5: cal5a=夏天/湿热, cal5b=冬天/干燥, cal5c=四季都用
  const seasonMap: Record<string, NonNullable<CalPreferences['season']>> = {
    cal5a: 'summer', cal5b: 'winter', cal5c: 'any',
  };
  // cal6: cal6a=300 以内, cal6b=300–800, cal6c=800 以上
  const budgetMap: Record<string, NonNullable<CalPreferences['budget']>> = {
    cal6a: 'low', cal6b: 'mid', cal6c: 'high',
  };

  if (calChoices.length < 3) return null;

  return {
    scentStyle: scentMap[calChoices[0]] ?? 'clean',
    longevityPref: longevityMap[calChoices[1]] ?? 'medium',
    occasion: occasionMap[calChoices[2]] ?? 'daytime',
    // 下标 3/4/5 对应 CALIBRATION_ORDER 里的 cal4/cal5/cal6；
    // 老用户只有 3 条答案 → undefined → null → 对应评分退化为常数 50（不产生任何调整）
    avoid: avoidMap[calChoices[3]] ?? null,
    season: seasonMap[calChoices[4]] ?? null,
    budget: budgetMap[calChoices[5]] ?? null,
  };
}

/** 香水三段香调拼成的检索文本 */
function perfumeNotesText(perfume: Perfume): string {
  return [
    ...perfume.notes.top,
    ...perfume.notes.heart,
    ...perfume.notes.base,
  ].join(' ');
}

const clamp0to100 = (n: number): number => Math.min(100, Math.max(0, n));

/** cal1 气息偏向 → 香水 notes 得分 (0-100) */
function calScentScore(perfume: Perfume, pref: CalPreferences): number {
  const allNotes = [
    ...perfume.notes.top,
    ...perfume.notes.heart,
    ...perfume.notes.base,
  ].join(' ');

  const patterns: Record<CalPreferences['scentStyle'], RegExp[]> = {
    sweet: [/香草|焦糖|蜂蜜|可可|奶油|杏仁|巧克力|椰子|棉花糖|零陵香豆|美食|甜/, /gour/],
    clean: [/薄荷|海盐|海洋|青草|柑橘|柠檬|佛手柑|葡萄柚|橙花|薰衣草|绿茶|fresh|citrus/],
    deep: [/沉香|乌木|檀香|雪松|皮革|广藿香|焚香|烟|琥珀|oriental|woody/],
  };

  const matches = patterns[pref.scentStyle] ?? [];
  let hits = 0;
  for (const p of matches) {
    if (p.test(allNotes)) hits++;
  }
  return Math.min(100, hits * 25);
}

/** cal2 留香 → longevity 匹配 (0-100) */
function calLongevityScore(perfume: Perfume, pref: CalPreferences): number {
  const l = perfume.longevity;
  switch (pref.longevityPref) {
    case 'long':  return l >= 4 ? 100 : l === 3 ? 60 : 20;
    case 'medium': return l >= 3 && l <= 4 ? 100 : l === 2 || l === 5 ? 60 : 20;
    case 'light':  return l <= 2 ? 100 : l === 3 ? 60 : 20;
  }
}

/** cal3 场合 → intensity 匹配 (0-100) */
function calOccasionScore(perfume: Perfume, pref: CalPreferences): number {
  const i = perfume.intensity;
  switch (pref.occasion) {
    case 'solo':    return i <= 3 ? 100 : i === 4 ? 50 : 20;  // 独处→低调
    case 'daytime': return i >= 3 && i <= 4 ? 100 : i === 2 || i === 5 ? 50 : 20; // 白天→适中
    case 'date':    return i >= 4 ? 100 : i === 3 ? 60 : 20;  // 约会→有存在感
  }
}

// ════════════════════════════════════════════════════════
// P1（2026-10-19）三道新校准题的评分函数
//
// 共同契约（极重要）：
//   未作答（null）或「都不排斥/中性」时，必须返回常数 50。
//   totalScore 用的是 (score - 50) * weight 形式，常数 50 → 调整量恒为 0
//   → 老用户（只有 3 条校准答案）与 16 原型 canonical 视图的结果逐位不变。
//
//   另外：这三题一律做「软加分/减分」，绝不做硬过滤。
//   硬过滤会直接把 P0 刚修好的覆盖度（96.9%）砍回去，与覆盖目标冲突。
// ════════════════════════════════════════════════════════

/** cal4 雷区 → 命中雷区的香减分 (0-100，未答/不避雷恒 50) */
function calAvoidScore(perfume: Perfume, pref: CalPreferences): number {
  const notes = perfumeNotesText(perfume);
  const desc = perfume.description;
  const hay = `${notes} ${desc}`;
  const patterns: Record<'sweet' | 'floral' | 'woody', RegExp> = {
    // 甜腻美食调
    sweet: /香草|焦糖|蜂蜜|可可|奶油|杏仁|巧克力|椰子|棉花糖|零陵香豆|太妃|糖|奶|gourmand/i,
    // 厚重白花与脂粉
    floral: /茉莉|晚香玉|栀子|白花|铃兰|依兰|鸢尾|粉|脂|floral/i,
    // 烟熏与重木质
    woody: /乌木|沉香|皮革|焚香|烟|雪松|广藿香|岩兰|香根草|woody|smoke/i,
  };
  if (!pref.avoid || pref.avoid === 'none') return 50;
  const re = patterns[pref.avoid];
  return re && re.test(hay) ? 10 : 60;
}

/** cal5 季节/温度 → 气候适配 (0-100，未答恒 50) */
function calSeasonScore(perfume: Perfume, pref: CalPreferences): number {
  if (!pref.season) return 50;
  const notes = perfumeNotesText(perfume);
  const cool = /薄荷|海盐|海洋|青草|柑橘|柠檬|佛手柑|葡萄柚|橙花|绿茶|水生|柚|fresh|citrus/i;
  const warm = /香草|琥珀|檀香|雪松|乌木|沉香|皮革|焚香|肉桂|零陵香豆|辛|oriental|woody/i;

  if (pref.season === 'summer') {
    let s = 50;
    if (cool.test(notes)) s += 25;
    if (warm.test(notes)) s -= 20;
    if (perfume.intensity >= 4) s -= 15;   // 夏天扛不住厚重的扩散
    return clamp0to100(s);
  }
  if (pref.season === 'winter') {
    let s = 50;
    if (warm.test(notes)) s += 25;
    if (cool.test(notes)) s -= 15;
    if (perfume.longevity <= 2) s -= 15;   // 冬天留不住的香等于没喷
    return clamp0to100(s);
  }
  // 四季都用 → 中庸最优：扩散与留香都落在中段
  const iOk = perfume.intensity >= 3 && perfume.intensity <= 4;
  const lOk = perfume.longevity >= 3 && perfume.longevity <= 4;
  return clamp0to100(50 + (iOk ? 15 : -10) + (lOk ? 15 : -10));
}

/** cal6 预算 → 价位适配 (0-100，未答恒 50)。按单 ml 价比，不比整瓶绝对价。 */
function calBudgetScore(perfume: Perfume, pref: CalPreferences): number {
  if (!pref.budget) return 50;
  const perMl = parseLowPricePerMl(perfume.priceRange);
  if (perMl <= 0) return 50;
  switch (pref.budget) {
    case 'low':  return perMl <= 8 ? 100 : perMl <= 18 ? 60 : 25;
    case 'mid':  return perMl > 8 && perMl <= 25 ? 100 : perMl <= 8 ? 55 : 60;
    case 'high': return perMl >= 20 ? 100 : perMl >= 10 ? 60 : 30;
  }
  return 50;
}

// ════════════════════════════════════════════════════════
// P2（2026-10-19）离线语义层：温度 × 质感的匹配
//
// 为什么需要：6 维余弦已经撞天花板（Top-1 0.96 / Top-20 仍有 0.885，
// 见 scripts/verify-coverage-window.ts）。再调权重榨不出区分度，
// 只能换「表示」——这里引入两个 6 维雷达完全没有的轴：
//   temp     体感冷暖（-1 冷 … +1 暖）
//   texture  质感（花瓣/粉/水/烟/奶/绿/木/辛/果/皮革/树脂/矿物）
//
// 为什么是静态查表：语义由 scripts/gen-perfume-semantics.ts 离线生成，
// 运行时只读表，零 LLM 调用、零延迟、完全可复现。
//
// 熔断开关：语义层任何异常都可一键关停，退回「不参与打分」的常数 50，
// 不会带崩推荐（新增信号层必须有撤退路径，这是硬要求）。
// ════════════════════════════════════════════════════════
const SEMANTICS_ENABLED = true;

/** 用户的语义偏好（温度 + 带符号的质感权重，负值表示雷区） */
interface SemanticPref {
  temp: number;                                  // -1..1
  texture: Partial<Record<Texture, number>>;     // 可正可负
}

/**
 * 由校准答案推导用户的语义偏好。
 * 关键约束：只有答过 cal4（雷区）或 cal5（季节）才返回非 null。
 * 老用户只有 cal1-3 → 返回 null → 语义评分恒为 50 → 增量恒为 0 → 零漂移。
 * （若这里用 cal1/cal3 也能触发，老用户结果就会变，历史契约就破了。）
 */
function userSemanticPref(prefs: CalPreferences): SemanticPref | null {
  if (!prefs.avoid && !prefs.season) return null;

  // 温度：季节是主信号（±0.8）
  let temp = 0;
  if (prefs.season === 'summer') temp = -0.8;
  else if (prefs.season === 'winter') temp = 0.8;
  else if (prefs.season === 'any') temp = 0;

  const texture: Partial<Record<Texture, number>> = {};
  const add = (t: Texture, v: number) => { texture[t] = (texture[t] ?? 0) + v; };

  // 质感：cal1 气息偏向 + cal3 场合 + cal4 雷区（负向）
  switch (prefs.scentStyle) {
    case 'sweet': add('milk', 1); add('fruit', 0.4); break;
    case 'clean': add('water', 1); add('green', 0.5); break;
    case 'deep':  add('wood', 1); add('resin', 0.6); add('smoke', 0.3); break;
  }
  switch (prefs.occasion) {
    case 'date':    add('petal', 0.8); add('milk', 0.4); break;
    case 'daytime': add('water', 0.6); add('green', 0.4); break;
    case 'solo':    add('wood', 0.6); add('smoke', 0.5); add('resin', 0.4); break;
  }
  switch (prefs.avoid) {
    case 'sweet':  add('milk', -1.2); break;
    case 'floral': add('petal', -1.2); add('powder', -0.8); break;
    case 'woody':  add('wood', -1.2); add('smoke', -1); add('resin', -0.6); break;
  }
  return { temp, texture };
}

/** 语义契合度 (0-100，未启用/未作答/缺数据恒 50) */
function semanticScore(perfume: Perfume, prefs: CalPreferences): number {
  if (!SEMANTICS_ENABLED) return 50;
  const pref = userSemanticPref(prefs);
  const sem = getPerfumeSemantics(perfume.id);
  if (!pref || !sem || Object.keys(sem.texture).length === 0) return 50;

  // 温度对齐：|Δ| ∈ [0,2] → 对齐度 ∈ [1,0]
  const tempAlign = 1 - Math.min(2, Math.abs(sem.temp - pref.temp)) / 2;

  // 质感契合：pref 带符号（负值=雷区），与香的质感分布做余弦
  let dot = 0;
  let pNorm = 0;
  for (const [k, v] of Object.entries(pref.texture)) {
    pNorm += v * v;
    dot += v * (sem.texture[k as Texture] ?? 0);
  }
  let sNorm = 0;
  for (const v of Object.values(sem.texture)) sNorm += (v ?? 0) ** 2;
  const texFit = pNorm > 0 && sNorm > 0 ? dot / Math.sqrt(pNorm * sNorm) : 0; // -1..1

  return clamp0to100(50 + (tempAlign - 0.5) * 40 + texFit * 40);
}

/** 香水描述关键词匹配用户路径标签 (0-100 bonus) */
function descriptionBonus(perfume: Perfume, pathLabels: string[]): number {
  const desc = perfume.description;
  const pathText = pathLabels.join(' ');
  let hits = 0;
  // 路径标签中的关键词出现在描述中则加分
  const kwMap: Record<string, string> = {
    甜润: '柔|暖|甜|蜜', 清冽: '清|透|水|冷', 深沉: '深|沉|暗|厚',
    持久: '长|久|持', 适中: '中|均|衡', 清淡: '淡|轻|薄',
    独处夜: '独|夜|私|静', 白天: '日|阳|明|亮', 约会: '迷|约|吸|诱',
  };
  for (const label of pathLabels) {
    const re = kwMap[label];
    if (re && new RegExp(re).test(desc)) hits++;
  }
  return hits * 8;
}

/** 品牌分散惩罚：同品牌其他香水已入选则减分（跨档去重的基础机制） */
function brandPenalty(perfume: Perfume, selectedBrands: Set<string>): number {
  return selectedBrands.has(perfume.brand) ? -15 : 0;
}

/** 单支香水的综合得分（雷达 0.35 + 校准气息 0.25 + 留香 0.20 + 场合 0.15 + 描述 0.05）
 * 雷达相似度使用 18 维分阶段计算（前/中/后调各 6 维，加权求和）
 */
function totalScore(
  perfume: Perfume,
  radar: ScentVector,
  prefs: CalPreferences,
  pathLabels: string[],
): number {
  // 混合相似度：50% 18D（前/中/后调拆分，保留区分度）+ 50% 6D（整体印象，拉高绝对分）
  // 单用 18D 会把绝对分压到 50 上下（用户只有 6D 向量，与拆分的稀疏段比对天然偏低）；
  // 单用 6D 会虚高到 97 且失去区分度（历史教训：“都 99% 不正常”）。各取一半最稳。
  const radarScore =
    cosineSimilarity18D(radar, getPerfumeProfile18D(perfume)) * 100 * 0.5 +
    cosineSimilarity(radar, getPerfumeProfile(perfume)) * 100 * 0.5;
  const calScent = calScentScore(perfume, prefs);
  const calLongevity = calLongevityScore(perfume, prefs);
  const calOccasion = calOccasionScore(perfume, prefs);
  const descBonus = descriptionBonus(perfume, pathLabels);

  // ── P1 三道新校准题：以「零中心增量」叠加，而不是并入上面的固定权重 ──
  // 形式：(score - 50) * weight。未作答时 score 恒为 50 → 增量恒为 0，
  // 因此老用户（3 条校准答案）与 canonical 视图的分数与排序逐位不变。
  // 这样做的好处是新信号可以自由加，而不必每次都重分配已有权重（那会全量漂移）。
  const avoidAdj = (calAvoidScore(perfume, prefs) - 50) * 0.12;
  const seasonAdj = (calSeasonScore(perfume, prefs) - 50) * 0.08;
  const budgetAdj = (calBudgetScore(perfume, prefs) - 50) * 0.06;
  // 权重 0.26 由 scripts/verify-semantics-lift.ts 实测扫描确定（2026-10-19）：
  //   权重   用户表态命中率   本命香雷达相似度（护栏）
  //   0（关）   69.01%          0.6416
  //   0.10      73.44%          0.6363
  //   0.18      74.22%          0.6331
  //   0.26      77.60%          0.6287   ← 取此点：+8.6pp 命中率，只掉 2.0% 相似度
  //   0.34      79.43%          0.6247
  //   0.45      83.07%          0.6230
  // 「相似度掉多少算可接受」的标尺来自 P0 实测（scripts/verify-coverage-window.ts）：
  // 第 1 名 0.9614 → 第 20 名 0.8853，差 8% 都在用户感知之外，
  // 所以 2% 的代价换 8.6pp 的「说到做到」是划算的。
  const semanticAdj = (semanticScore(perfume, prefs) - 50) * 0.26;

  return (
    radarScore * 0.45 +   // 雷达（最准信号）权重上调
    calScent * 0.15 +     // 香调偏好下调（与雷达有重叠，避免重复计权）
    calLongevity * 0.20 +
    calOccasion * 0.15 +
    descBonus * 0.05 +
    avoidAdj +            // cal4 雷区（负向信号，单题性价比最高）
    seasonAdj +           // cal5 季节/温度
    budgetAdj +           // cal6 预算（软加分，绝不硬过滤）
    semanticAdj           // P2 离线语义层：温度 × 质感（只有答过 cal4/cal5 才激活）
  );
}

// ════════════════════════════════════════════════════════
// 平价档多样性：预计算每支 budget 香水的「垄断频率」
// 统计在 16 个原型各自的校准输入下，该香水成为平价档榜首的次数占比（0~1）。
// 值越高说明它越是「在多个不同画像下都排第一」的通用香（如「绅士/安娜苏」），
// 这是平价档重复（跨原型都拿到同一支）的根源。仅在平价档选择时按垄断频率做去偏，
// 促使推荐分散到更贴合各画像的具体香；去偏基于「无惩罚时的榜首频率」，稳定可复现。
// ════════════════════════════════════════════════════════

// 由原型固有字段确定性推导其校准输入（与比对/验证脚本保持一致）
export function inferArchetypeCal(t: {
  scentDirection?: string;
  description?: string;
  mbtiAlias?: string;
  name?: string;
}): { calChoices: string[]; pathLabels: string[] } {
  const text = `${t.scentDirection ?? ''} ${t.description ?? ''} ${t.mbtiAlias ?? ''} ${t.name ?? ''}`;
  const has = (...kw: string[]) => kw.some((k) => text.includes(k));
  let c1 = 'cal1b';
  if (has('甜', '暖', '舒缓', '白花', '棉花', '橙花', '玫瑰', '鸢尾', '紫罗兰', '晚香玉', '麝香', '柔')) c1 = 'cal1a';
  if (has('不甜', '克制', '禁欲', '冷', '冽', '雪松', '焚香', '木质', '乌木', '檀', '深', '极简', '海', '沉')) c1 = 'cal1c';
  let c2 = 'cal2b';
  if (has('持久', '长', '厚', '留香', '气场', '力量', '领袖', '精英', '深沉', '稳重')) c2 = 'cal2a';
  if (has('清淡', '轻', '薄', '清新', '舒缓', '极简')) c2 = 'cal2c';
  let c3 = 'cal3b';
  if (has('独处', '夜', '静', '极简', '思', '哲学', '研究', '本质', '理性', '洞察')) c3 = 'cal3a';
  if (has('约会', '迷', '约', '吸引', '社交', '朋友圈', '暖阳', '活力', '冒险')) c3 = 'cal3c';
  const pathLabels: string[] = [
    c1 === 'cal1a' ? '甜润' : c1 === 'cal1b' ? '清冽' : '深沉',
    c2 === 'cal2a' ? '持久' : c2 === 'cal2b' ? '适中' : '清淡',
    c3 === 'cal3a' ? '独处夜' : c3 === 'cal3b' ? '白天' : '约会',
  ];
  return { calChoices: [c1, c2, c3], pathLabels };
}

let _budgetMonopoly: Map<string, number> | null = null;
function budgetMonopoly(): Map<string, number> {
  if (_budgetMonopoly) return _budgetMonopoly;
  const archs = PERSONALITY_TYPES as {
    radarScores: ScentVector;
    scentDirection?: string;
    description?: string;
    mbtiAlias?: string;
    name?: string;
  }[];
  const count = new Map<string, number>();
  for (const a of archs) {
    const { calChoices, pathLabels } = inferArchetypeCal(a);
    const prefs = parseCalPreferences(calChoices);
    if (!prefs) continue;
    let bestId = '';
    let bestScore = -Infinity;
    for (const p of Object.values(PERFUMES)) {
      if (p.tier !== 'budget') continue;
      const s = totalScore(p, a.radarScores, prefs, pathLabels);
      if (s > bestScore) {
        bestScore = s;
        bestId = p.id;
      }
    }
    if (bestId) count.set(bestId, (count.get(bestId) ?? 0) + 1);
  }
  const m = new Map<string, number>();
  for (const [id, c] of count) m.set(id, c / archs.length);
  _budgetMonopoly = m;
  return m;
}

// ════════════════════════════════════════════════════════
// 平价档按「校准方向」分桶分配表（v2，2026-08-20 重构）
//
// 旧逻辑问题：buildBudgetAssignment 按「原型」分配，用原型推断的校准选品，
// 但展示给用户时用用户真实校准评分。当用户校准 ≠ 原型推断校准时，
// 固定分配的香水严重不匹配（实测出现 28% 这种极低分）。
//
// 新逻辑：按「校准方向组合」分配（cal1 × cal2 × cal3 = 27 种），
// 用中性雷达（0.5 全维）+ 该方向的校准选品。运行时按用户真实校准查表。
// 保留全局去重：27 个方向各自拿到互不重复的 budget 香。
// 27 < 47（budget 池大小），数学上可保证全不重复。
// 结果在模块加载时计算一次并缓存（纯函数，确定可复现）。
// ════════════════════════════════════════════════════════

/** 27 种校准方向组合：cal1(3) × cal2(3) × cal3(3) */
const ALL_CAL_KEYS: readonly string[] = (() => {
  const keys: string[] = [];
  for (const c1 of ['cal1a', 'cal1b', 'cal1c']) {
    for (const c2 of ['cal2a', 'cal2b', 'cal2c']) {
      for (const c3 of ['cal3a', 'cal3b', 'cal3c']) {
        keys.push(`${c1}|${c2}|${c3}`);
      }
    }
  }
  return keys;
})();

/** 从用户校准选项推导 calKey（如 "cal1a|cal2c|cal3b"） */
function getCalKey(calChoices: string[]): string {
  if (calChoices.length < 3) return 'cal1b|cal2b|cal3b'; // 兜底：中性
  return `${calChoices[0]}|${calChoices[1]}|${calChoices[2]}`;
}

let _budgetDirectionAssignment: Map<string, string[]> | null = null;
function buildBudgetDirectionAssignment(): Map<string, string[]> {
  if (_budgetDirectionAssignment) return _budgetDirectionAssignment;
  const budgetPool = (Object.values(PERFUMES) as Perfume[]).filter((p) => p.tier === 'budget');

  // 中性雷达（0.5 全维）→ 分配不偏向任何香调族，仅由 cal 方向驱动
  const neutralRadar: ScentVector = { floral: 0.5, woody: 0.5, fresh: 0.5, oriental: 0.5, citrus: 0.5, gourmand: 0.5 };

  type Cand = { calKey: string; perfume: string; score: number };
  const cands: Cand[] = [];
  for (const calKey of ALL_CAL_KEYS) {
    const [c1, c2, c3] = calKey.split('|') as [string, string, string];
    const prefs = parseCalPreferences([c1, c2, c3]);
    if (!prefs) continue;
    // 路径标签置空：分配不依赖用户具体路径（运行时再用真实 pathLabels 重算）
    for (const p of budgetPool) {
      cands.push({ calKey, perfume: p.name, score: totalScore(p, neutralRadar, prefs, []) });
    }
  }

  // 2026-09-16 改进：原先每个方向只锁 1 支且运行时无条件覆盖 MMR 结果，导致
  //   (a) budget 池 47 支里有 20 支在任何用户路径下都不可能出现（实测死数据）；
  //   (b) 用户可能拿到相对低分的那一支，MMR / 垄断去偏那段排序沦为死代码。
  // 现改为：每个方向保留一组互不重复的候选，运行时按该用户的真实分数择优。
  // 去重约束依然成立（同一方向 / 跨方向都不重复），覆盖与质量同时提升。
  const used = new Set<string>();
  const assigned = new Map<string, string[]>();
  const sorted = [...cands].sort((x, y) => y.score - x.score);
  for (let round = 0; round < CANDIDATES_PER_DIRECTION; round++) {
    for (const c of sorted) {
      const list = assigned.get(c.calKey) ?? [];
      if (list.length >= CANDIDATES_PER_DIRECTION) continue; // 该方向已满
      if (used.has(c.perfume)) continue;                     // 该香已被别的方向占用
      list.push(c.perfume);
      assigned.set(c.calKey, list);
      used.add(c.perfume);
    }
  }
  // 兜底：极端情况下池耗尽时，未分配到任何候选的方向取其自身最高分
  for (const calKey of ALL_CAL_KEYS) {
    if (assigned.has(calKey)) continue;
    const top = cands.filter((c) => c.calKey === calKey).sort((x, y) => y.score - x.score)[0];
    if (top) assigned.set(calKey, [top.perfume]);
  }
  _budgetDirectionAssignment = assigned;
  return assigned;
}

/** 每个方向最多保留几支候选香（受全局去重约束，实际数量可能更少） */
const CANDIDATES_PER_DIRECTION = 3;

// 保留旧函数名以兼容外部引用（内部已重定向到方向分配）
/** @deprecated 请使用 buildBudgetDirectionAssignment（按 calKey 分配） */
function buildBudgetAssignment(): Map<string, string[]> {
  return buildBudgetDirectionAssignment();
}

// ════════════════════════════════════════════════════════════════════════════
// 原型级预算分配表（v3，2026-08-21）：
// 解决「16 原型共用 8 支尝试香」的可见重复。
// buildBudgetDirectionAssignment 按 calKey（27 槽）去重，但 inferArchetypeCal
// 把 16 原型收拢成 8 个 calKey，导致原型/Codex/分享卡（canonical）视图出现重复。
// 本表按 16 原型各自贪心选香（用各原型自身雷达 + 推断校准），保证 16 支互不重复。
// 真实用户路径（useArchetypeBudget=false）不调用本表，仍走 calKey，保留校准对齐。
// ════════════════════════════════════════════════════════════════════════════
let _archetypeBudgetAssignment: Map<string, string[]> | null = null;
function buildArchetypeBudgetAssignment(): Map<string, string[]> {
  if (_archetypeBudgetAssignment) return _archetypeBudgetAssignment;
  const archs = PERSONALITY_TYPES as {
    id: string;
    radarScores: ScentVector;
    scentDirection?: string;
    description?: string;
    mbtiAlias?: string;
    name?: string;
  }[];
  const budgetPool = (Object.values(PERFUMES) as Perfume[]).filter((p) => p.tier === 'budget');

  type Cand = { archId: string; perfume: string; score: number };
  const cands: Cand[] = [];
  for (const a of archs) {
    const { calChoices, pathLabels } = inferArchetypeCal(a);
    const prefs = parseCalPreferences(calChoices);
    if (!prefs) continue;
    const radarEn = normalizeRadarToEn(a.radarScores as Record<string, number>);
    for (const p of budgetPool) {
      cands.push({ archId: a.id, perfume: p.name, score: totalScore(p, radarEn, prefs, pathLabels) });
    }
  }

  // 2026-09-16 改进：与 buildBudgetDirectionAssignment 同理，
  // 每个原型保留一组互不重复的候选（而非只锁 1 支），
  // 运行时按该原型/用户的真实分数择优 —— 既守住「16 原型不重复」，也把覆盖面打开。
  const used = new Set<string>();
  const assigned = new Map<string, string[]>();
  const sorted = [...cands].sort((x, y) => y.score - x.score);
  for (let round = 0; round < CANDIDATES_PER_DIRECTION; round++) {
    for (const c of sorted) {
      const list = assigned.get(c.archId) ?? [];
      if (list.length >= CANDIDATES_PER_DIRECTION) continue; // 该原型已满
      if (used.has(c.perfume)) continue;                     // 已被别的原型占用
      list.push(c.perfume);
      assigned.set(c.archId, list);
      used.add(c.perfume);
    }
  }
  // 兜底：极端情况下池 < 16 时，未分配原型取其自身最高分
  for (const a of archs) {
    if (assigned.has(a.id)) continue;
    const top = cands.filter((c) => c.archId === a.id).sort((x, y) => y.score - x.score)[0];
    if (top) {
      assigned.set(a.id, [top.perfume]);
      used.add(top.perfume);
    }
  }
  _archetypeBudgetAssignment = assigned;
  return assigned;
}

export interface CalibratedRecommendation {
  name: string;
  brand: string;
  brandCn: string;
  notes: string;
  notesStructured: { top: string[]; heart: string[]; base: string[] };
  quote: string;
  tier: Perfume['tier'];            // 真实数据档位（premium/budget）
  role: 'signature' | 'advanced' | 'budget';  // 展示角色：本命香/进阶香/尝试香
  match: number;
  priceRange: string;
  intensity: number;
  longevity: number;
  score: number;
}

/**
 * 解析 priceRange 的「单 ml 最低价」（如 "¥800-1100/50ml" → 800/50 = 16/ml，"¥650/30ml" → 21.7/ml）
 * 注意：必须按单 ml 比价，不能比整瓶绝对价——否则 30ml 贵货(¥650/30ml=21.7/ml)会被 100ml 便宜货(¥1000/100ml=10/ml)
 * 反超，导致「高定价」门槛反而放过桶装便宜货。无 ml 后缀时默认 50ml 兜底。
 */
function parseLowPricePerMl(priceRange: string): number {
  const priceM = priceRange.match(/¥\s*(\d+)/);
  const mlM = priceRange.match(/\/(\d+)\s*ml/i);
  const price = priceM ? parseInt(priceM[1], 10) : 0;
  const ml = mlM ? parseInt(mlM[1], 10) : 50;
  if (price <= 0) return 0;
  return price / ml;
}

/**
 * 进阶香价格门槛（元/ml）：进阶香只从单 ml 价不低于该值的香里选，保证高定价定位。
 * 改法 B：本命香与进阶香都来自 premium 合并池（原 signature+advanced 合并）。
 * 数据分布（单 ml 中位）：premium ¥18、budget ¥2.4。
 * 门槛设为 20 可将进阶香锁定在「轻奢/高端」区间（premium 池中 ≥¥20/ml 的香远多于改法 B 前的 advanced 档），
 * 与 ¥2.4/ml 尝试香拉开明显档次。
 */
const ADVANCED_MIN_PRICE_PER_ML = 20;

/**
 * 本命香展示匹配度映射：把原始总分（当前真实分布约 55-80）线性映射到 85-95。
 * 用户要求本命香匹配度落在 85%~95% 区间（进阶/尝试保持真实分，梯度不乱：
 * 本命香是 top1，映射后仍 ≥ 进阶香）。
 * raw=55 → 85，raw=80 → 95；越界 clamp。
 */
function mapSignatureMatch(raw: number): number {
  const MIN_RAW = 55;
  const MAX_RAW = 80;
  const MIN_DISP = 85;
  const MAX_DISP = 95;
  const clamped = Math.min(Math.max(raw, MIN_RAW), MAX_RAW);
  const t = (clamped - MIN_RAW) / (MAX_RAW - MIN_RAW);
  return Math.round(MIN_DISP + t * (MAX_DISP - MIN_DISP));
}

// ════════════════════════════════════════════════════════
// 选择层 · 确定性加权随机（P0，2026-10-18）
//
// 背景：高端档原本是「纯 top-1 / top-2 硬择优」，导致 225 支里 104 支
//       在任何用户路径下都推不出去（见 audit-perfume-reachability）。
//
// 关键实测（scripts/verify-coverage-window.ts）：匹配分数曲线是「平」的——
//   第 1 名相似度 0.96、第 12 名 0.91，仅差 6%。
//   → 推第 1 还是第 12，用户感知不到差别，但覆盖度能翻数倍。
//
// 因此本层做两件事，分别对应两个独立旋钮：
//   ① 相关性下限（PREMIUM_RELEVANCE_FLOOR）→ 锁死精度，不合格的香绝不入选
//   ② 窗口内加权随机                        → 打开覆盖，让长尾有机会
//
// 确定性原则：随机必须由 userSeed 驱动，同一种子必得同一结果
//   · 真实用户路径传 vid → 同一用户刷新不变、分享卡对得上，但不同用户拿到不同长尾香
//   · canonical 视图（不传 userSeed）→ 完全走原逻辑，16 原型展示 / 分享卡零变动
// ════════════════════════════════════════════════════════

/**
 * 高端档候选窗口大小。
 * 实测（scripts/verify-coverage-window.ts）：Top-12 精度衰减 6.2%、覆盖不足；
 * Top-20 精度衰减 8.5%（仍在容忍内）但覆盖显著提升，故取 20。
 */
const PREMIUM_WINDOW = 20;
/** 相关性下限：候选分数不得低于窗口内最高分的该比例 */
const PREMIUM_RELEVANCE_FLOOR = 0.85;
/** 多样性下限权重：0 = 纯按分（退化成原逻辑），越大越均匀 */
const PREMIUM_MIN_WEIGHT = 0.15;
/** 权重指数：1 = 线性；<1 更均匀（覆盖更高），>1 更偏向头部（精度更高） */
const PREMIUM_DIVERSITY_GAMMA = 1.0;

/** 字符串 → 32 位种子（FNV-1a，与 lib/daily/draw.ts 同族的确定性做法） */
function hashSeed(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32：同一种子必产生同一序列 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 加权抽样（确定性：给定 rng 与权重数组，结果唯一） */
function weightedPick<T>(items: T[], weights: number[], rng: () => number): T | undefined {
  if (items.length === 0) return undefined;
  const total = weights.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return items[0];
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * 校准匹配推荐：从香水库按用户偏好 + 雷达图打分，每个角色返回最佳匹配
 * @param radarScores 用户 6 维雷达分值 (0-1)
 * @param calChoices 校准题原始选择 ['cal1a','cal2b','cal3c']
 * @param pathLabels 全部题目路径标签（含分支题 + 校准题）
 * @param archetypeId 可选，传入用户所属原型 id 时，平价档强制走「全局去重分配表」
 *                      （保证 16 个原型各拿到一支互不重复的平价香，消除跨原型霸榜）
 * @param userSeed 可选，稳定用户标识（vid）。传入时高端档启用「窗口内加权随机」以打开覆盖；
 *                 不传（canonical 视图）时保持原确定性择优，行为零变化。
 */
export function getCalibratedRecommendations(
  radarScores: ScentVector,
  calChoices: string[],
  pathLabels: string[] = [],
  archetypeId?: string,
  useArchetypeBudget = false,
  userSeed?: string,
): CalibratedRecommendation[] {
  const prefs = parseCalPreferences(calChoices);
  if (!prefs) return [];

  // 随机种子基：仅在传入 userSeed 时启用（真实用户路径）
  const seedBase = userSeed ? `${userSeed}|${calChoices.join('|')}` : '';

  // 修复：用户雷达向量可能是中文键（来自 personalities.getRadarScores），
  // 内部的 cosineSimilarity 使用英文键（floral/woody/...），混用会 NaN。
  const radarEn = normalizeRadarToEn(radarScores as Record<string, number>);

  const selectedBrands = new Set<string>();
  const perfumes = Object.values(PERFUMES);

  // 对每支香水打分（综合得分）
  const scored2 = perfumes.map((perfume) => ({
    perfume,
    totalScore: totalScore(perfume, radarEn, prefs!, pathLabels),
  }));

  // ═══ 推荐池结构（方案 B）═══
  // 池 A（高端）：premium 池（原 signature + advanced 合并），取 top 2 → 角色分别为 本命香 / 进阶香
  // 池 B（平价）：budget 单独取 top 1 → 角色为 尝试香
  // 本命香来自 premium 合并池 top1，tier 保留真实档位（premium/budget），role 表示展示位置
  const results: CalibratedRecommendation[] = [];
  const selectedNames = new Set<string>();      // 跨池同名去重
  const selectedProfiles: ScentVector[] = [];    // MMR：与已选香气的相似度惩罚
  const gen = budgetMonopoly();
  // 平价档多样性参数（仅作用于 budget 档，不影响本命/进阶的相关性）
  // gen 取值 0~1（该香水在 16 原型中当平价档榜首的频率）
  // 系数经扫描确定：BMK=9 时平价档独特数 7→10、最大重复 6→4，相关性仅降约 9.5%
  const BUDGET_MONOPOLY_K = 9;       // 垄断去偏强度（惩罚上限约 9 分）
  const BUDGET_MMR_LAMBDA = 0.10;    // 与已选香气的相似度惩罚强度

  // ── 池 A：高端合并（premium = 原 signature + advanced 合并）取 top 2 ──
  const premiumCandidates = scored2.filter(
    (s) => s.perfume.tier === 'premium'
  );
  // 综合排序：总分 + 跨品牌去重 + 同名去重
  premiumCandidates.sort((a, b) => {
    let aScore = a.totalScore + brandPenalty(a.perfume, selectedBrands);
    let bScore = b.totalScore + brandPenalty(b.perfume, selectedBrands);
    if (selectedNames.has(a.perfume.name)) aScore -= 1e6;
    if (selectedNames.has(b.perfume.name)) bScore -= 1e6;
    return bScore - aScore;
  });

  // 本命香：合并池 top1（价格不限，取最佳契合）
  // 进阶香：合并池中价格 ≥ ADVANCED_MIN_PRICE 的香，排除本命香品牌/同名，取 top1
  //         （保证进阶香高定价定位；若高价池为空则退回普通高端香，避免进阶香为空）
  // 合格候选窗口：
  //   ① 过滤掉已选 / 同品牌 / 价格不达标的
  //   ② 取前 PREMIUM_WINDOW 支（premiumCandidates 已按分降序）
  //   ③ 再用「相关性下限」剔除分数过低的 —— 这一步锁死精度
  const buildPremiumWindow = (
    minPricePerMl: number,
  ): typeof premiumCandidates => {
    const eligible = premiumCandidates.filter(
      (c) =>
        !selectedNames.has(c.perfume.name) &&
        !selectedBrands.has(c.perfume.brand) && // 本命/进阶不同品牌
        parseLowPricePerMl(c.perfume.priceRange) >= minPricePerMl,
    );
    if (eligible.length === 0) return [];
    const floor = eligible[0].totalScore * PREMIUM_RELEVANCE_FLOOR;
    return eligible.slice(0, PREMIUM_WINDOW).filter((c) => c.totalScore >= floor);
  };

  const pickPremium = (role: 'signature' | 'advanced', minPricePerMl: number): typeof premiumCandidates[number] | undefined => {
    const win = buildPremiumWindow(minPricePerMl);
    if (win.length === 0) return undefined;

    // canonical 视图（无 userSeed）：完全保持原「取最高分」行为，零变化
    if (!seedBase) return win[0];

    // 真实用户路径：窗口内按分数加权随机（确定性，由 userSeed 驱动）
    const best = win[0].totalScore;
    const floor = best * PREMIUM_RELEVANCE_FLOOR;
    const span = Math.max(best - floor, 1e-6);
    const rng = mulberry32(hashSeed(`${seedBase}|${role}`));
    const weights = win.map((c) => {
      const norm = Math.min(1, Math.max(0, (c.totalScore - floor) / span));
      return PREMIUM_MIN_WEIGHT + Math.pow(norm, PREMIUM_DIVERSITY_GAMMA);
    });
    return weightedPick(win, weights, rng);
  };

  // 1) 本命香（无价格门槛）
  const signatureCand = pickPremium('signature', 0);
  if (signatureCand) {
    selectedBrands.add(signatureCand.perfume.brand);
    selectedNames.add(signatureCand.perfume.name);
    selectedProfiles.push(getPerfumeProfile(signatureCand.perfume));
    const rawMatch = Math.round(signatureCand.totalScore);
    results.push({
      name: signatureCand.perfume.name,
      brand: signatureCand.perfume.brand,
      brandCn: signatureCand.perfume.brandCn,
      notes: [
        ...signatureCand.perfume.notes.top,
        ...signatureCand.perfume.notes.heart,
        ...signatureCand.perfume.notes.base,
      ].join(' / '),
      notesStructured: { ...signatureCand.perfume.notes },
      quote: `「${signatureCand.perfume.description}」`,
      tier: signatureCand.perfume.tier,
      role: 'signature',
      match: mapSignatureMatch(rawMatch), // 本命香展示分映射到 85-95
      priceRange: signatureCand.perfume.priceRange,
      intensity: signatureCand.perfume.intensity,
      longevity: signatureCand.perfume.longevity,
      score: signatureCand.totalScore,
    });
  }

  // 2) 进阶香（单ml价格门槛 ADVANCED_MIN_PRICE_PER_ML，高价池为空则 fallback 到无门槛）
  let advancedCand = pickPremium('advanced', ADVANCED_MIN_PRICE_PER_ML);
  if (!advancedCand) advancedCand = pickPremium('advanced', 0); // 兜底：高价池空也不留空
  if (advancedCand) {
    selectedBrands.add(advancedCand.perfume.brand);
    selectedNames.add(advancedCand.perfume.name);
    selectedProfiles.push(getPerfumeProfile(advancedCand.perfume));
    const rawMatch = Math.round(advancedCand.totalScore);
    results.push({
      name: advancedCand.perfume.name,
      brand: advancedCand.perfume.brand,
      brandCn: advancedCand.perfume.brandCn,
      notes: [
        ...advancedCand.perfume.notes.top,
        ...advancedCand.perfume.notes.heart,
        ...advancedCand.perfume.notes.base,
      ].join(' / '),
      notesStructured: { ...advancedCand.perfume.notes },
      quote: `「${advancedCand.perfume.description}」`,
      tier: advancedCand.perfume.tier,
      role: 'advanced',
      match: rawMatch,
      priceRange: advancedCand.perfume.priceRange,
      intensity: advancedCand.perfume.intensity,
      longevity: advancedCand.perfume.longevity,
      score: advancedCand.totalScore,
    });
  }

  // ── 池 B：平价（budget）取 top 1 作为 尝试香 ──
  const budgetCandidates = scored2.filter((s) => s.perfume.tier === 'budget');
  budgetCandidates.sort((a, b) => {
    let aScore = a.totalScore + brandPenalty(a.perfume, selectedBrands);
    let bScore = b.totalScore + brandPenalty(b.perfume, selectedBrands);
    if (selectedNames.has(a.perfume.name)) aScore -= 1e6;
    if (selectedNames.has(b.perfume.name)) bScore -= 1e6;
    // 垄断去偏 + MMR
    aScore -= (gen.get(a.perfume.id) ?? 0) * BUDGET_MONOPOLY_K;
    bScore -= (gen.get(b.perfume.id) ?? 0) * BUDGET_MONOPOLY_K;
    for (const sp of selectedProfiles) {
      aScore -= BUDGET_MMR_LAMBDA * 100 * cosineSimilarity(getPerfumeProfile(a.perfume), sp);
      bScore -= BUDGET_MMR_LAMBDA * 100 * cosineSimilarity(getPerfumeProfile(b.perfume), sp);
    }
    return bScore - aScore;
  });

  const budgetBest = budgetCandidates[0];
  if (budgetBest) {
    selectedBrands.add(budgetBest.perfume.brand);
    selectedNames.add(budgetBest.perfume.name);
    const rawMatch = Math.round(budgetBest.totalScore);
    results.push({
      name: budgetBest.perfume.name,
      brand: budgetBest.perfume.brand,
      brandCn: budgetBest.perfume.brandCn,
      notes: [
        ...budgetBest.perfume.notes.top,
        ...budgetBest.perfume.notes.heart,
        ...budgetBest.perfume.notes.base,
      ].join(' / '),
      notesStructured: { ...budgetBest.perfume.notes },
      quote: `「${budgetBest.perfume.description}」`,
      tier: budgetBest.perfume.tier,
      role: 'budget',
      match: rawMatch,
      priceRange: budgetBest.perfume.priceRange,
      intensity: budgetBest.perfume.intensity,
      longevity: budgetBest.perfume.longevity,
      score: budgetBest.totalScore,
    });
  }

  // 平价档全局去重（v3：按校准方向多候选择优，2026-09-16）：
  // 查表拿到该方向的候选组，再用「用户本次真实校准 + 真实雷达」重算分数择优。
  //
  // 2026-09-16 修复：v2 是无条件取表中唯一一支并整体覆盖 budgetBest，带来两个问题：
  //   (a) 每个方向锁死 1 支 → budget 池 47 支中 20 支在任何用户路径下都不可能出现；
  //   (b) 覆盖是硬覆盖 → 上面那段「MMR + 垄断去偏」排序算完即被丢弃，沦为死代码，
  //       用户还可能拿到候选里相对低分的那一支。
  // v3 保留去重语义（同一方向的候选互不重复、跨方向也不重复），
  // 但把「唯一答案」换成「候选组择优」，覆盖面与匹配质量同时提升。
  const calKey = getCalKey(calChoices);
  // 原型/Codex/分享卡（canonical）视图：按 16 原型各自的候选组，
  // 避免 16 原型因 calKey 收拢成 8 个而共用尝试香（可见重复）。
  // 真实用户路径（useArchetypeBudget=false）仍按 calKey 取候选，保留其校准对齐特性。
  const fixedNames = useArchetypeBudget && archetypeId
    ? buildArchetypeBudgetAssignment().get(archetypeId) ?? []
    : buildBudgetDirectionAssignment().get(calKey) ?? [];

  // 收集该方向的候选组（已在分配表中做完全局去重，跨方向不重复）
  const budgetCands: { cand: Perfume; score: number }[] = [];
  for (const candName of fixedNames) {
    const cand = (PERFUMES as Record<string, Perfume>)[candName];
    if (!cand || cand.tier !== 'budget') continue;
    budgetCands.push({ cand, score: totalScore(cand, radarEn, prefs!, pathLabels) });
  }

  // 平价档选优：
  //   · canonical（无种子）→ 保持原「取组内最高分」行为，零变化
  //   · 真实用户路径（有种子）→ 组内确定性加权随机。
  //     原因：组内冷门香在 argmax 下永远出不去（实测 47 支里有 10 支不可达），
  //     与高端档同理用加权随机打开覆盖。组内候选已全局去重，不影响跨方向唯一性。
  const pickBudget = (): { cand: Perfume; score: number } | undefined => {
    if (budgetCands.length === 0) return undefined;
    if (!seedBase) return budgetCands.reduce((a, b) => (b.score > a.score ? b : a));
    const best = Math.max(...budgetCands.map((c) => c.score));
    const floor = best * PREMIUM_RELEVANCE_FLOOR;
    const span = Math.max(best - floor, 1e-6);
    const rng = mulberry32(hashSeed(`${seedBase}|budget`));
    const weights = budgetCands.map((c) => {
      const norm = Math.min(1, Math.max(0, (c.score - floor) / span));
      return PREMIUM_MIN_WEIGHT + Math.pow(norm, PREMIUM_DIVERSITY_GAMMA);
    });
    return weightedPick(budgetCands, weights, rng);
  };

  let fixedRec: CalibratedRecommendation | null = null;
  const chosenBudget = pickBudget();
  if (chosenBudget) {
    const cand = chosenBudget.cand;
    const candScore = chosenBudget.score;
    // 平价档使用原始全局分数
    fixedRec = {
      name: cand.name,
      brand: cand.brand,
      brandCn: cand.brandCn,
      notes: [
        ...cand.notes.top,
        ...cand.notes.heart,
        ...cand.notes.base,
      ].join(' / '),
      notesStructured: { ...cand.notes },
      quote: `「${cand.description}」`,
      tier: cand.tier,
      role: 'budget',
      match: Math.round(candScore),
      priceRange: cand.priceRange,
      intensity: cand.intensity,
      longevity: cand.longevity,
      score: candScore,
    };
  }
  if (fixedRec) {
    const budgetIdx = results.findIndex((r) => r.role === 'budget');
    if (budgetIdx >= 0) results[budgetIdx] = fixedRec;
    else results.push(fixedRec);
  }

  return results;
}
