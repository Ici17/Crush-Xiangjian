// ============================================================
// Crush香鉴 — 香气探索（A 组卖点）
// ============================================================
//
// 全部复用已有的确定性算法，不引入新的数据源：
//   · 场景选香 —— 在人格的三档推荐里，按场景偏好再排序
//   · 以香搜人 —— 香水香调向量 → 与 16 人格雷达求余弦

import { PERFUMES, PERSONALITY_TYPES, type Perfume } from "./data";
import { getPerfumeProfile, cosineSimilarity, type ScentVector } from "./matchPerfumes";

type PersonalityTypeLite = {
  id: string;
  name: string;
  mbti?: string;
  tagline?: string;
  direction?: string;
  radarScores: Record<string, number>;
};

// 香水库存在 2 支「键」与「展示名」不一致（例：键 `白茶-祖玛珑` / 名 `白茶（祖玛珑）`）。
// 结果页与推荐结果对外给的是 **name**，而日签等内部逻辑用的是 **key**。
// 若只按 name 直接索引 PERFUMES，这 2 支会在「以香搜人 / 场景选香」里静默失效
// （查不到 → 被跳过 → 用户看到空白或兜底文案）。故统一走这个兼容查找。
let _nameIndex: Map<string, Perfume> | null = null;
function nameIndex(): Map<string, Perfume> {
  if (_nameIndex) return _nameIndex;
  const m = new Map<string, Perfume>();
  for (const p of Object.values(PERFUMES) as Perfume[]) m.set(p.name, p);
  _nameIndex = m;
  return m;
}

/** 按「香水库键」或「展示名」反查香水；查不到返回 undefined */
export function findPerfume(nameOrKey: string): Perfume | undefined {
  return (PERFUMES as Record<string, Perfume>)[nameOrKey] ?? nameIndex().get(nameOrKey);
}

/** 把 0-100 的原始雷达转成 0-1 的英文键向量 */
function radarToVector(raw: Record<string, number>): ScentVector {
  return {
    floral: (raw.floral ?? 50) / 100,
    woody: (raw.woody ?? 50) / 100,
    fresh: (raw.fresh ?? 50) / 100,
    oriental: (raw.oriental ?? 50) / 100,
    citrus: (raw.citrus ?? 50) / 100,
    gourmand: (raw.gourmand ?? 50) / 100,
  };
}

// ════════════════════════════════════════════════
// 一、以香搜人：香水 → 人格
// ════════════════════════════════════════════════

export interface PerfumeToPersonality {
  name: string;
  mbti: string;
  tagline: string;
  /** 契合度 0-100（由余弦相似度相对归一而来，用于排序展示） */
  match: number;
}

/**
 * 给定一支香水，反查最贴合的人格。
 *
 * 为什么值得做：225 支香里有过百支在推荐路径下永远推不到（长尾死库存），
 * 这个功能让用户可以从「我手上有这支香」反向进入人格体系，把死库存盘活。
 */
export function findPersonalitiesByPerfume(perfumeName: string, topN = 3): PerfumeToPersonality[] {
  const perfume = findPerfume(perfumeName);
  if (!perfume) return [];

  const perfumeVec = getPerfumeProfile(perfume);
  const scored = (PERSONALITY_TYPES as unknown as PersonalityTypeLite[]).map((t) => ({
    name: t.name,
    mbti: t.mbti ?? "",
    tagline: t.tagline ?? "",
    raw: cosineSimilarity(perfumeVec, radarToVector(t.radarScores)),
  }));

  const sorted = scored.sort((a, b) => b.raw - a.raw).slice(0, topN);
  if (sorted.length === 0) return [];

  // 余弦相似度绝对值偏集中，直接展示区分度差。
  // 按本批次做相对归一化到 58-96，保留排序关系、去掉最大值一定 100 的误导。
  const hi = sorted[0].raw;
  const lo = sorted[sorted.length - 1].raw;
  const span = hi - lo;
  return sorted.map((s) => ({
    name: s.name,
    mbti: s.mbti,
    tagline: s.tagline,
    match: Math.round(span > 1e-6 ? 58 + ((s.raw - lo) / span) * 38 : 96),
  }));
}

/** 按关键字搜索香水（名称 / 中文品牌 / 英文品牌），限制返回条数 */
export function searchPerfumes(keyword: string, limit = 24): Perfume[] {
  const kw = keyword.trim().toLowerCase();
  const all = Object.values(PERFUMES) as Perfume[];
  if (!kw) return all.slice(0, limit);
  return all
    .filter(
      (p) =>
        p.name.toLowerCase().includes(kw) ||
        (p.brandCn ?? "").toLowerCase().includes(kw) ||
        (p.brand ?? "").toLowerCase().includes(kw)
    )
    .slice(0, limit);
}

// ════════════════════════════════════════════════
// 二、场景选香：人格 + 场景 → 最合适的一支
// ════════════════════════════════════════════════

export type SceneKey = "date" | "office" | "travel" | "solo" | "social";

export interface SceneOption {
  key: SceneKey;
  label: string;
  icon: string;
  hint: string;
}

export const SCENE_OPTIONS: SceneOption[] = [
  { key: "date", label: "约会", icon: "🌹", hint: "留香要久，气场要近" },
  { key: "office", label: "办公", icon: "📖", hint: "收敛克制，不打扰别人" },
  { key: "travel", label: "出行", icon: "✈️", hint: "清爽提神，扛得住折腾" },
  { key: "solo", label: "独处", icon: "🌙", hint: "只为自己，不必讨好" },
  { key: "social", label: "聚会", icon: "🥂", hint: "记忆点强，容易被问" },
];

// 场景偏好：正向权重越大越优先
const SCENE_PREFERENCE: Record<SceneKey, Partial<Record<keyof ScentVector, number>>> = {
  date: { oriental: 3, floral: 2, gourmand: 1 },
  office: { fresh: 3, citrus: 2, floral: 1 },
  travel: { citrus: 3, fresh: 3 },
  solo: { woody: 3, oriental: 2 },
  social: { oriental: 2, gourmand: 3, floral: 1 },
};

// 注：Perfume.intensity / longevity 均为 1-5 的数字（见 lib/data.ts）

/**
 * 在具体候选中挑一支最适合该场景的香。
 * candidates 传入用户在结果页拿到的三档推荐即可。
 */
export interface ScenePick {
  name: string;
  brand?: string;
  brandCn?: string;
  reason: string;
}

/**
 * 品牌信息直接由调用方的候选带回，不在这里反查香水库 ——
 * 反查会撞上「部分香水 key≠name」的历史数据问题（见 findPerfume 注释）。
 */
export function pickPerfumeForScene(
  candidates: { name: string; brand?: string; brandCn?: string }[],
  scene: SceneKey
): ScenePick | null {
  if (candidates.length === 0) return null;

  const pref = SCENE_PREFERENCE[scene];
  let best: { name: string; brand?: string; brandCn?: string; score: number; reasons: string[] } | null = null;

  for (const cand of candidates) {
    const perfume = findPerfume(cand.name);
    if (!perfume) continue;

    const vec = getPerfumeProfile(perfume);
    let score = 0;
    const dims = Object.entries(pref) as [keyof ScentVector, number][];
    for (const [dim, weight] of dims) {
      score += (vec[dim] ?? 0) * weight * 10;
    }

    const longevity = perfume.longevity ?? 3;
    const intensity = perfume.intensity ?? 3;

    const reasons: string[] = [];
    if (scene === "date" || scene === "social") {
      score += longevity * 2;
      if (longevity >= 4) reasons.push("留香持久");
    }
    if (scene === "office") {
      score += (5 - intensity) * 3; // 越收敛越适合办公
      if (intensity <= 2) reasons.push("气味收敛");
    }

    const topDim = dims
      .map(([dim]) => [dim, vec[dim]] as [keyof ScentVector, number])
      .sort((a, b) => b[1] - a[1])[0];
    if (topDim && topDim[1] > 0.4) {
      reasons.push(`${SCENE_DIM_LABEL[topDim[0]]}调突出`);
    }

    if (!best || score > best.score) {
      // 品牌取「候选来源」优先，香水库作兜底
      best = {
        name: cand.name,
        brand: cand.brand || perfume.brand,
        brandCn: cand.brandCn || perfume.brandCn,
        score,
        reasons: reasons.slice(0, 2),
      };
    }
  }

  if (!best) return {
    name: candidates[0].name,
    brand: candidates[0].brand,
    brandCn: candidates[0].brandCn,
    reason: "与你的人格底色最贴合",
  };

  return {
    name: best.name,
    brand: best.brand,
    brandCn: best.brandCn,
    reason: best.reasons.length > 0 ? best.reasons.join(" · ") : "与你的人格底色最贴合",
  };
}

const SCENE_DIM_LABEL: Record<keyof ScentVector, string> = {
  floral: "花香",
  woody: "木质",
  fresh: "清新",
  oriental: "东方",
  citrus: "柑橘",
  gourmand: "美食",
};
