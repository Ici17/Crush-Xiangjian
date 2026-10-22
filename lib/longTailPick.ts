// ============================================================
// 长尾 / 死库存曝光挑选（结果页「想问点别的」用）
// ============================================================
//
// 为什么需要它：
//   推荐路径有很强的头部集中 —— 实测琥珀松林 768 次、木质玫瑰 524 次、暗黑天使 511 次。
//   而确定性路径推不到的香水库占近一半，它们在「每人只看 3 支」的结构里永远见不到光。
//   这里给它们一个曝光位：**不影响推荐结果，只在结果页额外给几支**。
//
// 设计边界（改之前先读）：
//   ✅ 只读：不修改任何推荐逻辑，不进 `recommendations`，不进 canonical
//   ✅ 完全确定性：同一 vid 永远得到同一批，不引入随机漂移
//   ❌ 不调模型 —— 这是规则挑选，零在线成本、零延迟
//
// 「长尾」怎么定义：不在当前用户 3 支推荐里、也不在 16 原型 canonical 推荐里。
//   用规则算而不是硬编码名单 —— 硬编码会随推荐调整悄悄过期（本项目最怕的坑）。

import { PERFUMES } from "@/lib/data";
import { PERSONALITY_TYPES } from "@/lib/data";
import type { Perfume } from "@/lib/data";
import { getCalibratedRecommendations } from "@/lib/matchPerfumes";
import {
  getPerfumeProfile,
  cosineSimilarity,
  type ScentVector,
} from "@/lib/matchPerfumes";
import { getPerfumeSemantics } from "@/lib/data/perfumeSemantics";
import { parsePriceRange } from "@/lib/priceRange";

/** FNV-1a：给 vid 一个稳定偏移，保证「同一人稳定、不同人多样」 */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

let canonCache: Set<string> | null = null;

/** 16 原型 canonical 推荐里出现过的香水名（结果稳定，缓存一次即可） */
function canonicalNames(): Set<string> {
  if (canonCache) return canonCache;
  const s = new Set<string>();
  for (const arch of PERSONALITY_TYPES) {
    const radar = arch.radarScores as unknown as ScentVector;
    for (const rec of getCalibratedRecommendations(
      radar,
      ["cal1b", "cal2b", "cal3b"],
      [],
      arch.id,
      true,
    )) {
      s.add(rec.name);
    }
  }
  canonCache = s;
  return s;
}

/** 从前 WINDOW 支里取，避免把完全不相关的香推给用户 */
const WINDOW = 30;

/**
 * 挑几支「平时轮不到」的香。
 * @param excludeNames 当前已展示的推荐（三香），必须排除
 * @param vid 访客 id —— 决定从窗口的哪个位置开始取
 */
export function pickLongTail(
  userVector: ScentVector,
  excludeNames: readonly string[],
  vid: string,
  n = 3,
): Perfume[] {
  const exclude = new Set<string>([...excludeNames, ...canonicalNames()]);

  const scored = Object.values(PERFUMES)
    .filter((p) => !exclude.has(p.name))
    .map((p) => ({ p, score: cosineSimilarity(userVector, getPerfumeProfile(p)) }))
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [];
  if (scored.length <= n) return scored.map((s) => s.p);

  const win = scored.slice(0, Math.min(WINDOW, scored.length));
  const off = hashStr(vid || "anon") % win.length;
  const out: Perfume[] = [];
  for (let i = 0; i < n && i < win.length; i++) {
    out.push(win[(off + i) % win.length].p);
  }
  return out;
}

/** 仅用于门禁/调试：当前长尾池有多大 */
export function longTailPoolSize(excludeNames: readonly string[] = []): number {
  const exclude = new Set<string>([...excludeNames, ...canonicalNames()]);
  return Object.values(PERFUMES).filter((p) => !exclude.has(p.name)).length;
}

// ────────────────────────────────────────────────
// 另外两种「追问」：按季节 / 按预算
// 同样是规则实现、零在线成本，且**不进推荐主链路**。
// ────────────────────────────────────────────────

/**
 * 当前月份 → 目标温度。
 *
 * ⚠️ 必须与 `PERFUME_SEMANTICS.temp` **同尺度**：temp 是 **-1 ~ 1**（实测 min -0.81 / max 1），
 * 不是 0-100。首版这里写成 20~85，结果 |temp - target| 对所有香水几乎是同一个常数，
 * 季节项退化、排序仍由气味契合单独决定 —— 1/4/7/10 四个月返回完全一样的结果。
 * 这个 bug 肉眼完全看不出来，所以门禁里加了「不同月份必须给出不同结果」的断言。
 */
const TEMP_BY_MONTH = [1, 1, 0.4, 0.2, -0.3, -0.8, -1, -1, -0.5, 0, 0.4, 0.9]; // 下标 0 = 1 月

export function targetTempForMonth(month: number): number {
  return TEMP_BY_MONTH[((month - 1) % 12 + 12) % 12] ?? 0;
}

/** 季节容差：只在这个温度带里挑（temp 尺度 -1~1） */
const TEMP_TOLERANCE = 0.6;

/** 按季节挑：与当前月份的目标温度最接近的几支 */
export function pickBySeason(
  userVector: ScentVector,
  excludeNames: readonly string[],
  vid: string,
  month: number,
  n = 3,
): Perfume[] {
  const target = targetTempForMonth(month);
  const exclude = new Set(excludeNames);
  const scored = Object.values(PERFUMES)
    .filter((p) => !exclude.has(p.name))
    .map((p) => {
      const sem = getPerfumeSemantics(p.id);
      // ⚠️ temp 尺度是 -1~1，中性是 **0**（不是 50 —— 那是 0-100 尺度的写法）
      const temp = sem?.temp ?? 0;
      const sim = cosineSimilarity(userVector, getPerfumeProfile(p));
      return { p, temp, sim };
    });

  // **先按季节圈定，再按气味契合排序**，而不是把两者混成一个分数。
  // 混分不行：sim 的量级会盖掉季节项，实测 7 月（要最凉）挑出来的 temp 全是正的。
  const inSeason = scored.filter((x) => Math.abs(x.temp - target) <= TEMP_TOLERANCE);
  const pool = inSeason.length >= n ? inSeason : scored; // 该季节太少就退回全量，宁可季节弱一点也不空手
  pool.sort((a, b) => b.sim - a.sim);

  return rotate(pool, vid, n).map((s) => s.p);
}

/** 按预算挑：区间下限 ≤ 预算 的里面，气味最契合的几支 */
export function pickByBudget(
  userVector: ScentVector,
  excludeNames: readonly string[],
  vid: string,
  budget: number,
  n = 3,
): Perfume[] {
  const exclude = new Set(excludeNames);
  const scored = Object.values(PERFUMES)
    .filter((p) => !exclude.has(p.name))
    .map((p) => ({ p, price: parsePriceRange(p.priceRange) }))
    // ⚠️ 三态：null = 价格未知，这里选择**排除**（预算是最硬的约束，
    //    把未知价的放进来等于没过滤）。
    .filter((x) => x.price !== null && x.price.min <= budget)
    .map((x) => ({ p: x.p, score: cosineSimilarity(userVector, getPerfumeProfile(x.p)) }))
    .sort((a, b) => b.score - a.score);

  return rotate(scored, vid, n).map((s) => s.p);
}

/** 从窗口里按 vid 稳定偏移取 n 个 */
function rotate<T>(scored: T[], vid: string, n: number): T[] {
  if (scored.length === 0) return [];
  if (scored.length <= n) return scored;
  const win = scored.slice(0, Math.min(WINDOW, scored.length));
  const off = hashStr(vid || "anon") % win.length;
  const out: T[] = [];
  for (let i = 0; i < n && i < win.length; i++) out.push(win[(off + i) % win.length]);
  return out;
}
