/**
 * unlockDeep.ts —— 结果页解锁区「更深一层」解读（F3）的**唯一取值口**
 *
 * 为什么单独一层而不是直接改 personalities.ts：
 *   那四个区块的现有文案是**手写静态内容**（HIDDEN_FACES / SCENT_ADVICE / SCENT_BLUEPRINTS），
 *   是产品与设计一起定的口径，也是历史快照的一部分。F3 不改它们，只在后面补一段更深的话 ——
 *   查不到就整段不渲染，回落到「只有原有内容」，绝不会出现半截文案。
 *
 * ⚠️ 这些文案在**付费墙内**（UnlockedContent 只在解锁后渲染），
 *    所以它们本身不承担转化钩子，承担的是「付了钱之后觉得值」。
 */

import { PERSONALITY_TYPES } from "@/lib/data";
import { UNLOCK_DEEP, type UnlockDeepBlock } from "@/lib/data/unlockDeep";

export type { UnlockDeepBlock };

export const UNLOCK_DEEP_BLOCKS: UnlockDeepBlock[] = [
  "hidden",
  "relation",
  "contrast",
  "blueprint",
];

/** 取某人格某区块的深度解读；人格不存在或文案缺失都返回 null（调用方整段不渲染） */
export function getUnlockDeep(
  personalityName: string | null | undefined,
  block: UnlockDeepBlock,
): string | null {
  if (!personalityName) return null;
  if (!PERSONALITY_TYPES.some((p) => p.name === personalityName)) return null;
  return UNLOCK_DEEP[`${personalityName}::${block}`] ?? null;
}
