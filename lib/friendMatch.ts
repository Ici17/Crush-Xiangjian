/**
 * Crush香鉴 — 朋友匹配逻辑
 *
 * 基于两个人格的香调向量，计算：
 * 1. 兼容性得分（0-100）
 * 2. 气味共鸣点（共同喜欢的香调）
 * 3. 互补建议（对方能弥补你的什么）
 * 4. 合照文案（2-3句诗意的社交媒体文案）
 */

import type { PersonalityType } from "./data";

export interface CompatibilityResult {
  score: number;
  grade: "灵魂伴侣" | "天生一对" | "互补有趣" | "各有所爱" | "气质迥异";
  gradeColor: string;
  sharedNotes: string[];
  complement: string;
  story: string;
  shareText: string;
  compareScores: {
    floral: number;
    woody: number;
    fresh: number;
    oriental: number;
    citrus: number;
    gourmand: number;
  };
}

export function calculateCompatibility(
  me: PersonalityType,
  friend: PersonalityType
): CompatibilityResult {
  // 向量相似度（余弦相似度）
  const myVec = [
    me.radarScores.floral,
    me.radarScores.woody,
    me.radarScores.fresh,
    me.radarScores.oriental,
    me.radarScores.citrus,
    me.radarScores.gourmand,
  ];
  const friendVec = [
    friend.radarScores.floral,
    friend.radarScores.woody,
    friend.radarScores.fresh,
    friend.radarScores.oriental,
    friend.radarScores.citrus,
    friend.radarScores.gourmand,
  ];

  // 维度数量
  const D = myVec.length;

  // ── 复合打分：同频共鸣 + 互补吸引 ──
  // 同频共鸣：双方都偏好的维度，取两者较小值累加（共享越多越高）
  // 互补吸引：一方高、另一方低的维度，差值累加（反差越大越互补）
  const RES_THRESH = 45; // 视为「偏好该香调」的下限
  const LOW_THRESH = 28; // 视为「对该香调无感」的上限
  let resSum = 0;
  let compSum = 0;
  for (let i = 0; i < D; i++) {
    if (myVec[i] >= RES_THRESH && friendVec[i] >= RES_THRESH) {
      resSum += Math.min(myVec[i], friendVec[i]);
    }
    if (myVec[i] >= RES_THRESH && friendVec[i] <= LOW_THRESH) {
      compSum += myVec[i] - friendVec[i];
    } else if (friendVec[i] >= RES_THRESH && myVec[i] <= LOW_THRESH) {
      compSum += friendVec[i] - myVec[i];
    }
  }
  const resonance = Math.min(resSum / 300, 1); // 3 个共享高分维度 ≈ 满分
  const complementScore = Math.min(compSum / 300, 1); // 互补差值累计 300 ≈ 满分
  const score = 20 + Math.round(100 * (0.7 * resonance + 0.3 * complementScore));

  const { grade, gradeColor } = (() => {
    if (score >= 75) return { grade: "灵魂伴侣" as const, gradeColor: "#C4956A" };
    if (score >= 65) return { grade: "天生一对" as const, gradeColor: "#8B6F5C" };
    if (score >= 55) return { grade: "互补有趣" as const, gradeColor: "#7DB9B6" };
    if (score >= 42) return { grade: "各有所爱" as const, gradeColor: "#9BA8AB" };
    return { grade: "气质迥异" as const, gradeColor: "#C4A99E" };
  })();

  const THRESH = 45;
  const dimensions = [
    { key: "floral" as const, label: "花香调", emoji: "🌹" },
    { key: "woody" as const, label: "木质调", emoji: "🪵" },
    { key: "fresh" as const, label: "清新调", emoji: "🌊" },
    { key: "oriental" as const, label: "东方调", emoji: "✨" },
    { key: "citrus" as const, label: "柑橘调", emoji: "🍋" },
    { key: "gourmand" as const, label: "美食调", emoji: "🍫" },
  ];

  const sharedNotes: string[] = [];
  for (const dim of dimensions) {
    if (
      me.radarScores[dim.key] >= THRESH &&
      friend.radarScores[dim.key] >= THRESH
    ) {
      sharedNotes.push(`${dim.emoji} ${dim.label}`);
    }
  }

  const complements: string[] = [];
  for (const dim of dimensions) {
    const meV = me.radarScores[dim.key];
    const frV = friend.radarScores[dim.key];
    if (
      (meV >= RES_THRESH && frV <= LOW_THRESH) ||
      (frV >= RES_THRESH && meV <= LOW_THRESH)
    ) {
      const advice: Record<string, string> = {
        floral: "让对方带你体验花香调的浪漫，打开感性的另一面",
        woody: "对方的沉稳木质气息能平衡你的活力，带来内心安宁",
        fresh: "清新气息可以稀释你的浓度，让相处更轻松自在",
        oriental: "东方的神秘感能勾起你的好奇心，探索未知的世界",
        citrus: "柑橘的明亮能照亮你偶尔的阴郁，一起活得轻快",
        gourmand: "美食调的温暖能填满你心底的某个角落",
      };
      complements.push(advice[dim.key]);
    }
  }

  const complement =
    complements.length > 0
      ? complements[0]
      : "你们在嗅觉上各有偏好，但这恰恰让相处充满探索的乐趣";

  const stories = [
    `你们走进一家香氛买手店，${me.name}的人径直走向木质柜台，而${friend.name}的人停在了花香的角落。最后，你们各带了一瓶对方会喜欢的香，一起走在晚风里。`,
    `深夜的酒馆，你们各自点了杯威士忌，聊起最近在闻的香。${me.name}说着说着掏出了随身携带的香条，${friend.name}接过去闻了一下说：「果然是你。」`,
    `旅行时，${me.name}在免税店排大队，${friend.name}在咖啡厅等。回来后，两个人在酒店床上交换礼物，拆开的那一刻，相视而笑——这就是默契。`,
  ];
  const story = stories[score % stories.length];

  const shareText = [
    `我和${friend.name}的香气匹配度达到 ${score}%\n\n`,
    `我是${me.name}，他是${friend.name}\n`,
    `🔮 兼容评级：${grade}\n`,
    sharedNotes.length > 0
      ? `💫 我们共同喜欢的：${sharedNotes.join(" · ")}\n`
      : "",
    `📖 ${story}\n\n`,
    `#灵魂香气匹配 #${me.name} #${friend.name} #本命香 #香水测评`,
  ].join("");

  const compareScores: CompatibilityResult["compareScores"] = {
    floral: Math.round((me.radarScores.floral + friend.radarScores.floral) / 2),
    woody: Math.round((me.radarScores.woody + friend.radarScores.woody) / 2),
    fresh: Math.round((me.radarScores.fresh + friend.radarScores.fresh) / 2),
    oriental: Math.round((me.radarScores.oriental + friend.radarScores.oriental) / 2),
    citrus: Math.round((me.radarScores.citrus + friend.radarScores.citrus) / 2),
    gourmand: Math.round((me.radarScores.gourmand + friend.radarScores.gourmand) / 2),
  };

  return {
    score,
    grade,
    gradeColor,
    sharedNotes,
    complement,
    story,
    shareText,
    compareScores,
  };
}
