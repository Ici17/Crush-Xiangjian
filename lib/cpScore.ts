// ============================================================
// Crush香鉴 — 好友契合度分级（唯一真源）
// ============================================================
//
// 为什么要单独抽出来（2026-10-22 清理时踩到的）：
//   原先 tier 的四档写在 `app/friend/FriendView.tsx` 里，
//   而分享图的「相处建议句」`ADVICE_MAP` 在 `lib/shareCardRender.ts` 里另有一份键。
//   两处各写各的，结果 ADVICE_MAP 12 个键里 11 个是历史死键
//   （还混进了「灵魂伴侣」「天生一对」这类宿命表述），
//   而实际 4 个 tier 里 3 个根本没对应句、全落到 fallback —— 表看着满，其实只有 1 条生效。
//
// 现在：tier 全集在这里定义成联合类型，`ADVICE_MAP` 声明为 `Record<CpTier, string>`，
// **少一个键 TypeScript 直接编译不过**，不需要额外写门禁去守。
//
// 合规：tier 是「香气契合度」的审美分档，不是关系断言。

export const CP_TIERS = ['气息同频', '惊喜感', '新鲜感', '吸引力'] as const;

export type CpTier = (typeof CP_TIERS)[number];

export interface CpTierStory {
  tier: CpTier;
  copy: string;
}

/** 契合度四档解读（阈值与文案同处一处，改档不会漏改另一处） */
export function getCpTierStory(score: number): CpTierStory {
  if (score >= 75) {
    return {
      tier: '气息同频',
      copy: '你们的香气频率高度共振——靠近，就像回到了该在的地方。',
    };
  }
  if (score >= 55) {
    return {
      tier: '惊喜感',
      copy: '意外调出的好味道——你们的差异里，藏着彼此最缺的那一味。',
    };
  }
  if (score >= 42) {
    return {
      tier: '新鲜感',
      copy: '闻到陌生，也闻到新鲜——你们之间，总有还没说完的香气故事。',
    };
  }
  return {
    tier: '吸引力',
    copy: '忍不住想靠近，再靠近一点——截然不同的香调，却莫名相互吸引。',
  };
}
