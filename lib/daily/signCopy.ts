/**
 * signCopy.ts —— 今日香签个性化文案（F5）的**唯一取值口**
 *
 * 三件事都在这里，调用方不需要知道细节：
 *   1. 把语义层的 12 个 texture 键归并成 6 个「香调族」（确定 argmax）
 *   2. key / id / name 三向索引（库里有 3 支 id≠key，UI 手里通常只有 name）
 *   3. 按「人格 + 今日抽到的香 / 今日一语原句」取那一句文案
 *
 * ⚠️ 三条硬约束（改动前必读）：
 *   · **绝不碰 `lib/daily/draw.ts` / `pool.ts`** —— 抽签结果一个字都不能变，
 *     F5 只在展示层换一句话。`audit-pool-stable` 必须保持零漂移。
 *   · 未测过人格的用户返回 null，调用方回落原文案（description / almanac.note）。
 *   · 完全确定性：同样的（人格, 香, 日期）永远同一句，不引入随机。
 */

import { PERFUMES } from "@/lib/data";
import { PERFUME_SEMANTICS } from "@/lib/data/perfumeSemantics";
import type { Texture } from "@/lib/data/noteSemantics";
import { SIGN_LINES, SIGN_WORDS } from "@/lib/data/dailySigns";

/** 6 个香调族：把 12 个 texture 键按质感归并，避免「16 × 12 = 192 条」这种没必要的规模 */
export type SignFamily = "floral" | "woody" | "green" | "fruity" | "milky" | "spicy";

export const SIGN_FAMILIES: SignFamily[] = ["floral", "woody", "green", "fruity", "milky", "spicy"];

/** 族 → 归并的 texture 键（用词的语义相近度分组，不是均分数量） */
export const FAMILY_TEXTURES: Record<SignFamily, Texture[]> = {
  floral: ["petal", "powder"], // 花瓣 / 粉质
  woody: ["wood", "resin", "smoke"], // 木 / 树脂 / 烟熏
  green: ["green", "water", "mineral"], // 绿意 / 水感 / 矿物
  fruity: ["fruit"],
  milky: ["milk"],
  spicy: ["spice", "leather"], // 辛香 / 皮革
};

/** 族的中文说法（生成 prompt 与门禁输出共用，别在两处各写一份） */
export const FAMILY_LABEL: Record<SignFamily, string> = {
  floral: "花感与粉感",
  woody: "木质、树脂与烟熏",
  green: "绿意、水感与矿物",
  fruity: "果香的甜与圆",
  milky: "乳感的温润柔软",
  spicy: "辛香与皮革的棱角",
};

type Ref = { id?: string; name?: string };

let familyIndex: Map<string, SignFamily> | null = null;

/** 单支香 → 族：组内 texture 求和后取最大；并列按 SIGN_FAMILIES 顺序（确定性） */
function familyOfKey(key: string): SignFamily | null {
  const sem = PERFUME_SEMANTICS[key];
  if (!sem?.texture) return null;
  let best: SignFamily | null = null;
  let bestScore = -1;
  for (const f of SIGN_FAMILIES) {
    const score = FAMILY_TEXTURES[f].reduce((s, t) => s + (sem.texture[t] ?? 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
}

function buildFamilyIndex(): Map<string, SignFamily> {
  const m = new Map<string, SignFamily>();
  for (const [key, p] of Object.entries(PERFUMES)) {
    const f = familyOfKey(key);
    if (!f) continue;
    m.set(key, f);
    m.set(p.id, f);
    m.set(p.name, f);
  }
  familyIndex = m;
  return m;
}

/** 取一支香的香调族（查不到返回 null） */
export function getSignFamily(p: Ref | null | undefined): SignFamily | null {
  if (!p) return null;
  const m = familyIndex ?? buildFamilyIndex();
  return (p.id ? m.get(p.id) : undefined) ?? (p.name ? m.get(p.name) : undefined) ?? null;
}

/**
 * 签面短评：这支香今天对「这个人格」意味着什么。
 * 「香牌族」由数据决定，「人格」由 localStorage 决定 —— 两者都确定，故结果确定。
 */
export function getSignLine(
  personality: string | null | undefined,
  p: Ref | null | undefined,
): string | null {
  if (!personality) return null;
  const fam = getSignFamily(p);
  if (!fam) return null;
  return SIGN_LINES[`${personality}::${fam}`] ?? null;
}

/**
 * 今日一语：把全员同一句改写成「只对这个类型的人说」。
 * noteIndex 是原句在 NOTE_POOL 里的下标（由 lib/daily/almanac.ts 导出），
 * 这样文案与「今天抽到哪句」绑定，同一人格 8 天一轮换。
 */
export function getSignWord(
  personality: string | null | undefined,
  noteIndex: number,
): string | null {
  if (!personality || noteIndex < 0) return null;
  return SIGN_WORDS[`${personality}::${noteIndex}`] ?? null;
}
