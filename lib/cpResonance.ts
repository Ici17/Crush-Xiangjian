// ============================================================
// Crush香鉴 — 香气共鸣 / CP 共振 · 合香卡
// ============================================================
//
// 立场：玄学的壳，审美的核。
//   - 「合香」= 两人本命守护香的融合侧写，是「你们合在一起是什么味道」
//     的审美表达，不是命理/缘分断言
//   - 「差几调」= 两人主导香调族在 6 调环上的距离，读作互补/反差的程度，
//     无吉凶/命中注定表述
//   - 确定性：以两人人格名为种子，同一对永远得到同一支合香（利于分享传播）
//
// 输入：两个人格名；输出：合香名 / 三调 / 差几调 / 合香印 / 合香解读。

import { getGuardianPerfume, getRadarScores, RADAR_DIMS, type RadarDim } from '@/lib/personalities';

// 守护印深度：隐 > 雅 > 常（合香印取更深者）
const SEAL_DEPTH: Record<string, number> = { 隐: 3, 雅: 2, 常: 1 };
const SEAL_BY_DEPTH: Record<number, '隐' | '雅' | '常'> = { 3: '隐', 2: '雅', 1: '常' };

export interface CpResonance {
  blendName: string;      // 合香名（如「玫瑰与焚香」）
  top: string[];          // 前调（两人守护香融合去重）
  heart: string[];        // 中调
  base: string[];         // 后调
  diffTones: number;      // 差几调（0~3，6 调环最短距离）
  toneA: string;          // A 主导调族
  toneB: string;          // B 主导调族
  seal: '隐' | '雅' | '常'; // 合香印
  line: string;           // 合香解读（启示体）
}

function dedupe(arr: string[]): string[] {
  const out: string[] = [];
  for (const x of arr) if (x && !out.includes(x)) out.push(x);
  return out;
}

/** 主导调族：6 维雷达取最大值的维度 */
function topTone(name: string): RadarDim {
  const radar = getRadarScores(name);
  return (RADAR_DIMS as readonly RadarDim[]).reduce((a, b) =>
    (radar[a] ?? 0) > (radar[b] ?? 0) ? a : b
  );
}

/** 差几调：6 调环上的最短距离（0~3） */
function diffTones(a: RadarDim, b: RadarDim): number {
  const ia = RADAR_DIMS.indexOf(a);
  const ib = RADAR_DIMS.indexOf(b);
  const d = Math.abs(ia - ib);
  return Math.min(d, RADAR_DIMS.length - d);
}

// 合香解读（按差几调分档，启示体 · 合规）
const RESONANCE_LINES: Record<number, string> = {
  0: '同一种气息底色，让彼此靠近时，仿佛回到熟悉的地方。',
  1: '相邻的香调，像两步之外的默契，轻轻一碰就懂。',
  2: '隔了两调，各自完整，合在一起却有了新的层次。',
  3: '最远的香调，也是最深的吸引——你们互为彼此缺的那一味。',
};

/**
 * 取两人格的合香卡（确定性）。任一人格无守护香时返回 null。
 */
export function getCpResonance(nameA: string, nameB: string): CpResonance | null {
  const ga = getGuardianPerfume(nameA);
  const gb = getGuardianPerfume(nameB);
  if (!ga || !gb) return null;

  // 合香名：两人守护香中调首材意象相合（heart 为空则回落前调）
  const pickKey = (g: typeof ga) => g.notes.heart[0] ?? g.notes.top[0] ?? '';
  const keyA = pickKey(ga);
  const keyB = pickKey(gb);
  const blendName = keyA && keyB ? `${keyA}与${keyB}` : `${ga.name} × ${gb.name}`;

  // 三调融合：各自前/中/后去重拼接，各取前 3
  const top = dedupe([...ga.notes.top, ...gb.notes.top]).slice(0, 3);
  const heart = dedupe([...ga.notes.heart, ...gb.notes.heart]).slice(0, 3);
  const base = dedupe([...ga.notes.base, ...gb.notes.base]).slice(0, 3);

  const toneA = topTone(nameA);
  const toneB = topTone(nameB);
  const diff = diffTones(toneA, toneB);

  // 合香印：取更深者（隐 > 雅 > 常）
  const depth = Math.max(SEAL_DEPTH[ga.seal] ?? 1, SEAL_DEPTH[gb.seal] ?? 1);
  const seal = SEAL_BY_DEPTH[depth] ?? '常';

  return {
    blendName,
    top,
    heart,
    base,
    diffTones: diff,
    toneA,
    toneB,
    seal,
    line: RESONANCE_LINES[diff] ?? RESONANCE_LINES[1],
  };
}
