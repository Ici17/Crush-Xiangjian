// ============================================================
// Crush香鉴 — 香水匹配引擎 (18 维向量重构)
// 基于用户 6 维香调偏好向量 × 香水 18 维调香结构（前/中/后调各 6 维），
// 分阶段余弦相似度加权，对所有香水做精准重排，挑 topN
// ============================================================

import { PERFUMES, PERSONALITY_TYPES, type Perfume } from "./data";

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

  if (calChoices.length < 3) return null;

  return {
    scentStyle: scentMap[calChoices[0]] ?? 'clean',
    longevityPref: longevityMap[calChoices[1]] ?? 'medium',
    occasion: occasionMap[calChoices[2]] ?? 'daytime',
  };
}

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
  return (
    radarScore * 0.45 +   // 雷达（最准信号）权重上调
    calScent * 0.15 +     // 香调偏好下调（与雷达有重叠，避免重复计权）
    calLongevity * 0.20 +
    calOccasion * 0.15 +
    descBonus * 0.05
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
  if (has('甜', '暖', '治愈', '白花', '棉花', '橙花', '玫瑰', '鸢尾', '紫罗兰', '晚香玉', '麝香', '柔')) c1 = 'cal1a';
  if (has('不甜', '克制', '禁欲', '冷', '冽', '雪松', '焚香', '木质', '乌木', '檀', '深', '极简', '海', '沉')) c1 = 'cal1c';
  let c2 = 'cal2b';
  if (has('持久', '长', '厚', '留香', '气场', '力量', '领袖', '精英', '深沉', '稳重')) c2 = 'cal2a';
  if (has('清淡', '轻', '薄', '清新', '治愈', '极简')) c2 = 'cal2c';
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

let _budgetDirectionAssignment: Map<string, string> | null = null;
function buildBudgetDirectionAssignment(): Map<string, string> {
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

  // 贪心全局去重：按得分降序，每支香只分配给一个方向
  const used = new Set<string>();
  const assigned = new Map<string, string>();
  for (const c of [...cands].sort((x, y) => y.score - x.score)) {
    if (assigned.has(c.calKey)) continue;   // 该方向已分配
    if (used.has(c.perfume)) continue;      // 该香已被别的方向占用
    assigned.set(c.calKey, c.perfume);
    used.add(c.perfume);
  }
  // 兜底：极端情况下方向数超过池大小时，未分配方向取其自身最高分
  for (const calKey of ALL_CAL_KEYS) {
    if (assigned.has(calKey)) continue;
    const top = cands.filter((c) => c.calKey === calKey).sort((x, y) => y.score - x.score)[0];
    if (top) assigned.set(calKey, top.perfume);
  }
  _budgetDirectionAssignment = assigned;
  return assigned;
}

// 保留旧函数名以兼容外部引用（内部已重定向到方向分配）
/** @deprecated 请使用 buildBudgetDirectionAssignment（按 calKey 分配） */
function buildBudgetAssignment(): Map<string, string> {
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
let _archetypeBudgetAssignment: Map<string, string> | null = null;
function buildArchetypeBudgetAssignment(): Map<string, string> {
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

  // 贪心全局去重：按得分降序，每个原型拿其最佳且未被占用的香
  const used = new Set<string>();
  const assigned = new Map<string, string>();
  for (const c of [...cands].sort((x, y) => y.score - x.score)) {
    if (assigned.has(c.archId)) continue;
    if (used.has(c.perfume)) continue;
    assigned.set(c.archId, c.perfume);
    used.add(c.perfume);
  }
  // 兜底：极端情况下池 < 16 时，未分配原型取其自身最高分
  for (const a of archs) {
    if (assigned.has(a.id)) continue;
    const top = cands.filter((c) => c.archId === a.id).sort((x, y) => y.score - x.score)[0];
    if (top) {
      assigned.set(a.id, top.perfume);
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

/**
 * 校准匹配推荐：从香水库按用户偏好 + 雷达图打分，每个角色返回最佳匹配
 * @param radarScores 用户 6 维雷达分值 (0-1)
 * @param calChoices 校准题原始选择 ['cal1a','cal2b','cal3c']
 * @param pathLabels 全部 10 题路径标签
 * @param archetypeId 可选，传入用户所属原型 id 时，平价档强制走「全局去重分配表」
 *                      （保证 16 个原型各拿到一支互不重复的平价香，消除跨原型霸榜）
 */
export function getCalibratedRecommendations(
  radarScores: ScentVector,
  calChoices: string[],
  pathLabels: string[] = [],
  archetypeId?: string,
  useArchetypeBudget = false,
): CalibratedRecommendation[] {
  const prefs = parseCalPreferences(calChoices);
  if (!prefs) return [];

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
  const pickPremium = (role: 'signature' | 'advanced', minPricePerMl: number): typeof premiumCandidates[number] | undefined => {
    for (const cand of premiumCandidates) {
      if (selectedNames.has(cand.perfume.name)) continue;
      if (selectedBrands.has(cand.perfume.brand)) continue; // 本命/进阶不同品牌
      if (parseLowPricePerMl(cand.perfume.priceRange) < minPricePerMl) continue;
      return cand;
    }
    return undefined;
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

  // 平价档全局去重（v2：按校准方向分配，2026-08-20）：
  // 用「用户真实 calKey」查表，覆盖初始 budgetBest。
  // 核心改进：分配用 calKey 而非 archetypeId，用户校准方向改变时仍能匹配到适合的平价香。
  // 覆盖时按「用户本次真实校准 + 真实雷达」重算 match%，保证展示的匹配度对该用户诚实。
  const calKey = getCalKey(calChoices);
  // 原型/Codex/分享卡（canonical）视图：按 16 原型各自锁定一支不重复尝试香，
  // 避免 16 原型因 calKey 收拢成 8 个而共用尝试香（可见重复）。
  // 真实用户路径（useArchetypeBudget=false）仍按 calKey 分配，保留其校准对齐特性。
  const fixedName = useArchetypeBudget && archetypeId
    ? buildArchetypeBudgetAssignment().get(archetypeId)
    : buildBudgetDirectionAssignment().get(calKey);
  const fixedPerfume = fixedName ? (PERFUMES as Record<string, Perfume>)[fixedName] : undefined;
  if (fixedPerfume && fixedPerfume.tier === 'budget') {
      const fixedScore = totalScore(fixedPerfume, radarEn, prefs!, pathLabels);
      // 平价档使用原始全局分数
      const fixedRec: CalibratedRecommendation = {
        name: fixedPerfume.name,
        brand: fixedPerfume.brand,
        brandCn: fixedPerfume.brandCn,
        notes: [
          ...fixedPerfume.notes.top,
          ...fixedPerfume.notes.heart,
          ...fixedPerfume.notes.base,
        ].join(' / '),
        notesStructured: { ...fixedPerfume.notes },
        quote: `「${fixedPerfume.description}」`,
        tier: fixedPerfume.tier,
        role: 'budget',
        match: Math.round(fixedScore),
        priceRange: fixedPerfume.priceRange,
        intensity: fixedPerfume.intensity,
        longevity: fixedPerfume.longevity,
        score: fixedScore,
      };
      const budgetIdx = results.findIndex((r) => r.role === 'budget');
      if (budgetIdx >= 0) results[budgetIdx] = fixedRec;
      else results.push(fixedRec);
    }

  return results;
}
