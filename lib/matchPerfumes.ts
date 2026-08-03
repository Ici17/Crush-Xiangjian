// ============================================================
// Crush香鉴 — 香水匹配引擎
// 基于用户 6 维香调偏好向量，对所有香水做余弦相似度重排，挑 topN
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

export const DIMENSIONS: (keyof ScentVector)[] = [
  "floral",
  "woody",
  "fresh",
  "oriental",
  "citrus",
  "gourmand",
];

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

// 由香水 notes（前/中/后调）推导 6 维向量
export function getPerfumeProfile(perfume: Perfume): ScentVector {
  const cached = profileCache.get(perfume.id);
  if (cached) return cached;

  const v: ScentVector = {
    floral: 0, woody: 0, fresh: 0, oriental: 0, citrus: 0, gourmand: 0,
  };

  const allNotes = [
    ...perfume.notes.top,
    ...perfume.notes.heart,
    ...perfume.notes.base,
  ];

  for (const note of allNotes) {
    for (const kw of Object.keys(INGREDIENT_MAP)) {
      if (note.includes(kw)) {
        v[INGREDIENT_MAP[kw]] += 1;
      }
    }
  }

  profileCache.set(perfume.id, v);
  return v;
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
// 校准匹配算法：基于 cal1/cal2/cal3 用户偏好 + 雷达图，从 110 支香水库动态推荐
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

/** 单支香水的综合得分（雷达 0.35 + 校准气息 0.25 + 留香 0.20 + 场合 0.15 + 描述 0.05） */
function totalScore(
  perfume: Perfume,
  radar: ScentVector,
  prefs: CalPreferences,
  pathLabels: string[],
): number {
  const radarScore = cosineSimilarity(radar, getPerfumeProfile(perfume)) * 100;
  const calScent = calScentScore(perfume, prefs);
  const calLongevity = calLongevityScore(perfume, prefs);
  const calOccasion = calOccasionScore(perfume, prefs);
  const descBonus = descriptionBonus(perfume, pathLabels);
  return (
    radarScore * 0.35 +
    calScent * 0.25 +
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
function inferArchetypeCal(t: {
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
// 平价档全局去重分配表：彻底消除「跨原型平价香霸榜」
// 16 个原型 × 19 支平价香，因池子小、且通用高分香在多个画像下都排第一，
// 纯 per-user 贪心会让「绅士/安娜苏」等被多个原型同选。
// 解法：在「原型」层面做一次全局最优分配——按算法得分降序，每支平价香
// 只许分配给一个原型，使 16 个原型各拿到一支互不重复的平价香。
// 19 ≥ 16，数学上可保证全不重复；代价仅是平均得分微降（实验约 -4 分）。
// 结果在模块加载时计算一次并缓存（纯函数，确定可复现）。
// ════════════════════════════════════════════════════════
let _budgetAssignment: Map<string, string> | null = null;
function buildBudgetAssignment(): Map<string, string> {
  if (_budgetAssignment) return _budgetAssignment;
  const budgetPool = (Object.values(PERFUMES) as Perfume[]).filter((p) => p.tier === 'budget');
  const archs = PERSONALITY_TYPES as {
    id: string; name: string; radarScores: ScentVector;
    scentDirection?: string; description?: string; mbtiAlias?: string;
  }[];

  // 为每个原型计算其全部平价香得分（与该原型固有校准输入对齐）
  type Cand = { archId: string; perfume: string; score: number };
  const cands: Cand[] = [];
  for (const a of archs) {
    const { calChoices, pathLabels } = inferArchetypeCal(a);
    const prefs = parseCalPreferences(calChoices);
    if (!prefs) continue;
    for (const p of budgetPool) {
      cands.push({ archId: a.id, perfume: p.name, score: totalScore(p, a.radarScores, prefs, pathLabels) });
    }
  }

  // 贪心全局去重：按得分降序，每支香只分配给一个原型
  const used = new Set<string>();
  const assigned = new Map<string, string>();
  for (const c of [...cands].sort((x, y) => y.score - x.score)) {
    if (assigned.has(c.archId)) continue;   // 该原型已分配
    if (used.has(c.perfume)) continue;      // 该香已被别的原型占用
    assigned.set(c.archId, c.perfume);
    used.add(c.perfume);
  }
  // 兜底：极端情况下原型数超过池大小时，未分配原型取其自身最高分
  for (const a of archs) {
    if (assigned.has(a.id)) continue;
    const top = cands.filter((c) => c.archId === a.id).sort((x, y) => y.score - x.score)[0];
    if (top) assigned.set(a.id, top.perfume);
  }
  _budgetAssignment = assigned;
  return assigned;
}

export interface CalibratedRecommendation {
  name: string;
  brand: string;
  brandCn: string;
  notes: string;
  notesStructured: { top: string[]; heart: string[]; base: string[] };
  quote: string;
  tier: Perfume['tier'];
  match: number;
  priceRange: string;
  intensity: number;
  longevity: number;
  score: number;
}

/**
 * 校准匹配推荐：从 110 支香水库按用户偏好 + 雷达图打分，每个 tier 返回最佳匹配
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
): CalibratedRecommendation[] {
  const prefs = parseCalPreferences(calChoices);
  if (!prefs) return [];

  const selectedBrands = new Set<string>();
  const perfumes = Object.values(PERFUMES);

  // 对每支香水打分（综合得分）
  const scored2 = perfumes.map((perfume) => ({
    perfume,
    totalScore: totalScore(perfume, radarScores, prefs!, pathLabels),
  }));

  // 每个 tier 挑最佳
  const tiers: Perfume['tier'][] = ['signature', 'advanced', 'budget'];
  const results: CalibratedRecommendation[] = [];
  const selectedNames = new Set<string>();      // 跨档同名去重
  const selectedProfiles: ScentVector[] = [];    // MMR：与已选香气的相似度惩罚
  const gen = budgetMonopoly();
  // 平价档多样性参数（仅作用于 budget 档，不影响本命/进阶的相关性）
  // gen 取值 0~1（该香水在 16 原型中当平价档榜首的频率）
  // 系数经扫描确定：BMK=9 时平价档独特数 7→10、最大重复 6→4，相关性仅降约 9.5%
  const BUDGET_MONOPOLY_K = 9;       // 垄断去偏强度（惩罚上限约 9 分）
  const BUDGET_MMR_LAMBDA = 0.10;    // 与已选香气的相似度惩罚强度

  for (const tier of tiers) {
    const isBudget = tier === 'budget';
    const candidates = scored2.filter((s) => s.perfume.tier === tier);
    // 综合排序：总分 + 跨档品牌去重 + 跨档同名去重 + (平价档) 通用度去偏 + MMR
    candidates.sort((a, b) => {
      let aScore = a.totalScore + brandPenalty(a.perfume, selectedBrands);
      let bScore = b.totalScore + brandPenalty(b.perfume, selectedBrands);
      // 防御性跨档同名去重（tier 互斥下不会触发，但保持语义完整）
      if (selectedNames.has(a.perfume.name)) aScore -= 1e6;
      if (selectedNames.has(b.perfume.name)) bScore -= 1e6;
      if (isBudget) {
        // (1) 垄断去偏：对「在多个画像下都排第一」的通用香减分，促成分散
        //     gen 为 0~1 的榜首频率，乘系数后作为惩罚
        aScore -= (gen.get(a.perfume.id) ?? 0) * BUDGET_MONOPOLY_K;
        bScore -= (gen.get(b.perfume.id) ?? 0) * BUDGET_MONOPOLY_K;
        // (2) MMR：与已选（本命/进阶）香气越像，越不优先，拉开三档体验差异
        for (const sp of selectedProfiles) {
          aScore -= BUDGET_MMR_LAMBDA * 100 * cosineSimilarity(getPerfumeProfile(a.perfume), sp);
          bScore -= BUDGET_MMR_LAMBDA * 100 * cosineSimilarity(getPerfumeProfile(b.perfume), sp);
        }
      }
      return bScore - aScore;
    });

    const best = candidates[0];
    if (!best) continue;

    selectedBrands.add(best.perfume.brand);
    selectedNames.add(best.perfume.name);
    selectedProfiles.push(getPerfumeProfile(best.perfume));

    results.push({
      name: best.perfume.name,
      brand: best.perfume.brand,
      brandCn: best.perfume.brandCn,
      notes: [
        ...best.perfume.notes.top,
        ...best.perfume.notes.heart,
        ...best.perfume.notes.base,
      ].join(' / '),
      notesStructured: { ...best.perfume.notes },
      quote: `「${best.perfume.description}」`,
      tier: best.perfume.tier,
      match: Math.min(99, Math.round(best.totalScore)),
      priceRange: best.perfume.priceRange,
      intensity: best.perfume.intensity,
      longevity: best.perfume.longevity,
      score: best.totalScore,
    });
  }

  // 平价档全局去重：给定用户所属原型时，用预计算的分配表覆盖平价香，
  // 使 16 个原型各拿到一支互不重复的平价香（彻底消除跨原型霸榜）。
  // 覆盖时按「用户本次真实校准」重算 match%，保证展示的匹配度对该用户诚实。
  if (archetypeId) {
    const fixedName = buildBudgetAssignment().get(archetypeId);
    const fixedPerfume = fixedName ? (PERFUMES as Record<string, Perfume>)[fixedName] : undefined;
    if (fixedPerfume && fixedPerfume.tier === 'budget') {
      const fixedScore = totalScore(fixedPerfume, radarScores, prefs!, pathLabels);
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
        match: Math.min(99, Math.round(fixedScore)),
        priceRange: fixedPerfume.priceRange,
        intensity: fixedPerfume.intensity,
        longevity: fixedPerfume.longevity,
        score: fixedScore,
      };
      const budgetIdx = results.findIndex((r) => r.tier === 'budget');
      if (budgetIdx >= 0) results[budgetIdx] = fixedRec;
      else results.push(fixedRec);
    }
  }

  return results;
}
