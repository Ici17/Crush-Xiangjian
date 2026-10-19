/**
 * Crush香鉴 — 今日穿香建议（零 AI，纯规则）
 *
 * 来源：竞品 Kaori 的「今日穿哪支」是它最有价值的功能 —— 把推荐从「一次性结果」
 * 变成「每天都要做一次的决策」。我们已有「今日香签」，但它是**仪式**（全员同签、
 * 娱乐性），不是决策。本模块在不动香签的前提下，并行给出一条**穿香建议**。
 *
 * ⚠️ 三条硬约束（改这个文件时必须守住）：
 *  1. **不碰 `lib/daily/draw.ts` 与 `pool.ts`**：抽签结果与日签快照一个字都不能改，
 *     历史契约指纹由 `audit-pool-stable` 守着。本模块是**独立并行的第二条路径**。
 *  2. **全员同卡 + 完全确定性**：同一天所有人看到同一组建议（与香签「确定性是特性」一致）。
 *     个人化只体现在「标注」，绝不体现在「换候选」—— 否则就破坏了全员共此一笺的传播性。
 *  3. **不接天气 API**：H5 拿不到定位（且位置属隐私），所以用**节气**代替天气。
 *     文案只讲节气氛围，不承诺「今天 28℃」。
 *
 * 想调效果？改下面这张 `TERM_ADVICE` 表就够了 —— 所有可调参数都集中在这里，
 * 别散到组件里。改完跑 `npx tsx scripts/verify-daily-advice.ts`。
 */

import { PERFUMES } from "@/lib/data";
import { getSolarTermPhase } from "./night";
import { getPerfumeSemantics } from "@/lib/data/perfumeSemantics";
import { getTodayStr } from "./draw";

// ============================================================
// 节气 → 穿香条件（唯一的调优入口）
// ============================================================
// maxIntensity 扩散上限：天热时扩散太大 = 扰人，天冷时适当放大才闻得到
// minLongevity 留香下限：出汗/干燥季节留香差，要选更持久的
// tempDir      体感冷暖方向（消费 P2 语义层的 temp 轴）
// note         一句节气氛围（诗化，绝不是天气播报）

export interface TermAdvice {
  /** 扩散上限；**null = 不设上限**（冬天不需要收着，硬设一个反而是假条件）。
   *  必须按香水库的真实分布来定 —— 见下方「可行区间」注释。 */
  maxIntensity: number | null;
  minLongevity: number;
  tempDir: TempDir;
  note: string;
}

/**
 * ⚠️ 可行区间（改表前必看，否则卡片会凑不满 3 支）
 * 225 支里 扩散=1 只有 6 支、=2 有 77 支、=3 有 80 支、=4 有 54 支、=5 有 8 支；
 * 留香≥1/2/3/4/5 = 225/219/177/111/53 支。
 * 组合可行数（扩散≤I 且 留香≥L，交叉后）：
 *   I≤1: L≥1 → 6，L≥2 及以上 → **0**（扩散 1 的香留香都很短）
 *   I≤2: L≥3 → 35，L≥4 → **2**，L≥5 → **0**
 *   I≤3: L≥4 → 50，L≥5 → 8
 *   I≤4: L≥4 → 103，L≥5 → 45
 *   I≤5（不限）: L≥4 → 111，L≥5 → 53
 * → **任何 (扩散≤1) 或 (扩散≤2 且 留香≥4) 的组合都不成立**，别往表里填。
 *   体感方向还会再筛掉一部分，所以留 3 支的余量时要按上表再打个折。
 */
export const TERM_ADVICE: Record<string, TermAdvice> = {
  // ── 冬：寒气最深，宜暖宜久（不设扩散上限）──
  小寒: { maxIntensity: null, minLongevity: 4, tempDir: "warm", note: "寒气最深，宜暖宜厚，留得住才闻得到" },
  大寒: { maxIntensity: null, minLongevity: 4, tempDir: "warm", note: "一年最冷时，香气也要抱得住人" },
  立春: { maxIntensity: 4, minLongevity: 3, tempDir: "warm", note: "风还硬，暖得别太张扬" },
  雨水: { maxIntensity: 4, minLongevity: 3, tempDir: "balanced", note: "湿气起，清透一点更舒服" },

  // ── 春：回暖，宜清不宜闷 ──
  惊蛰: { maxIntensity: 3, minLongevity: 3, tempDir: "balanced", note: "万物醒，气味也该轻起来" },
  春分: { maxIntensity: 3, minLongevity: 3, tempDir: "balanced", note: "昼夜均分，不偏不倚正好" },
  清明: { maxIntensity: 3, minLongevity: 3, tempDir: "cool", note: "雨意微凉，宜清不宜闷" },
  谷雨: { maxIntensity: 3, minLongevity: 3, tempDir: "cool", note: "湿度上来，收敛一点更得体" },

  // ── 夏：暑热，收敛 + 留香够长（出汗会吃掉香气）──
  立夏: { maxIntensity: 2, minLongevity: 3, tempDir: "cool", note: "暑气初起，宜清宜收" },
  小满: { maxIntensity: 2, minLongevity: 3, tempDir: "cool", note: "渐热，别让香气先于你到场" },
  芒种: { maxIntensity: 3, minLongevity: 4, tempDir: "cool", note: "闷热开始，留香要比扩散重要" },
  夏至: { maxIntensity: 3, minLongevity: 4, tempDir: "cool", note: "日最长，宜清宜静" },
  小暑: { maxIntensity: 2, minLongevity: 3, tempDir: "cool", note: "暑气渐盛，收着点更体面" },
  大暑: { maxIntensity: 2, minLongevity: 3, tempDir: "cool", note: "一年最热，宜清不宜厚" },

  // ── 秋：转燥转凉 ──
  立秋: { maxIntensity: 3, minLongevity: 4, tempDir: "cool", note: "暑气未散，仍以清爽为先" },
  处暑: { maxIntensity: 3, minLongevity: 3, tempDir: "balanced", note: "暑气止，可以慢慢放开了" },
  白露: { maxIntensity: 3, minLongevity: 4, tempDir: "balanced", note: "昼夜温差起，白天清、夜里暖" },
  秋分: { maxIntensity: 4, minLongevity: 4, tempDir: "balanced", note: "凉意渐起，留香可以长一些" },
  寒露: { maxIntensity: 4, minLongevity: 4, tempDir: "warm", note: "露寒，宜暖宜沉" },
  霜降: { maxIntensity: null, minLongevity: 4, tempDir: "warm", note: "秋意最深，厚一点刚好" },

  // ── 入冬 ──
  立冬: { maxIntensity: null, minLongevity: 4, tempDir: "warm", note: "入冬，香气也要有分量" },
  小雪: { maxIntensity: null, minLongevity: 4, tempDir: "warm", note: "冷得细密，宜厚宜久" },
  大雪: { maxIntensity: null, minLongevity: 4, tempDir: "warm", note: "天寒，把暖意穿在身上" },
  冬至: { maxIntensity: null, minLongevity: 5, tempDir: "warm", note: "夜最长，让香气陪得久一点" },
};

/** 备选：万一某个节气没配到（表被改坏时），不至于白屏 */
const FALLBACK: TermAdvice = {
  maxIntensity: 3,
  minLongevity: 3,
  tempDir: "balanced",
  note: "今日宜清宜稳",
};

export type TempDir = "cool" | "warm" | "balanced";

export const TEMP_LABEL: Record<TempDir, string> = {
  cool: "体感偏凉",
  warm: "体感偏暖",
  balanced: "冷暖适中",
};

export interface ScentAdvice {
  term: string;
  note: string;
  /** null = 不设上限（冬天不需要收着） */
  maxIntensity: number | null;
  minLongevity: number;
  tempDir: TempDir;
  tempLabel: string;
}

export function getScentAdvice(dateStr: string): ScentAdvice {
  const term = getSolarTermPhase(dateStr);
  const a = TERM_ADVICE[term] ?? FALLBACK;
  return {
    term,
    note: a.note,
    maxIntensity: a.maxIntensity,
    minLongevity: a.minLongevity,
    tempDir: a.tempDir,
    tempLabel: TEMP_LABEL[a.tempDir],
  };
}

// ── 确定性挑选（FNV-1a + mulberry32，与 lib/daily/draw.ts 同源思路）──
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 一组实际生效的筛选条件 */
export interface AppliedConditions {
  maxIntensity: number | null;
  minLongevity: number;
  tempDir: TempDir | null;
}

function tempOk(id: string, dir: TempDir | null): boolean {
  if (!dir || dir === "balanced") return true;
  const sem = getPerfumeSemantics(id);
  if (!sem) return true; // 语义层缺失时放行，绝不因为没数据就把香水藏起来
  return dir === "cool" ? sem.temp <= -0.05 : sem.temp >= 0.05;
}

/**
 * 从香水库筛出候选，再按日期种子稳定抽出 N 支。
 *
 * **分级放宽**：条件从严到宽依次尝试，取第一个凑得满 N 支的档位。
 *   0 严格（扩散 + 留香 + 体感）
 *   1 去掉体感方向
 *   2 留香 -1、扩散 +1（且不设体感）
 *   3 只留留香 -1
 *   4 全部放行（必然凑满）
 *
 * ⚠️ 关键设计：返回的是**实际生效的那组条件**（`applied`），卡片必须显示它。
 * 显示理想条件而给放宽后的候选 = 卡上写假话，比没有建议更糟。
 * `audit-daily-advice` 的 C 项就盯这件事，E 项还会报「哪个节气常年要靠放宽」——
 * 那说明表里那条定得不切实际，该回来改表，而不是让兜底替它兜一辈子。
 */
export function getAdvicePerfumes(dateStr: string, count = 3) {
  const advice = getScentAdvice(dateStr);
  const all = Object.values(PERFUMES);

  const cap0 = advice.maxIntensity;
  const floors = [advice.minLongevity, Math.max(1, advice.minLongevity - 1)];
  const levels: AppliedConditions[] = [
    { maxIntensity: cap0, minLongevity: floors[0], tempDir: advice.tempDir },
    { maxIntensity: cap0, minLongevity: floors[0], tempDir: null },
    {
      maxIntensity: cap0 === null ? null : Math.min(5, cap0 + 1),
      minLongevity: floors[1],
      tempDir: null,
    },
    { maxIntensity: null, minLongevity: floors[1], tempDir: null },
    { maxIntensity: null, minLongevity: 1, tempDir: null },
  ];

  let level = 0;
  let pool = all;
  for (let i = 0; i < levels.length; i++) {
    const c = levels[i];
    const hit = all.filter(
      (p) =>
        (c.maxIntensity === null || p.intensity <= c.maxIntensity) &&
        p.longevity >= c.minLongevity &&
        tempOk(p.id, c.tempDir),
    );
    pool = hit;
    level = i;
    if (hit.length >= count) break;
  }
  const applied = levels[level];

  // 与香签同理：先排序保证顺序稳定，再用日期种子做 Fisher-Yates
  const ordered = [...pool].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const rnd = mulberry32(hashStr(`advice|${dateStr}`));
  for (let i = ordered.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  }

  return {
    advice,
    applied,
    level,
    poolSize: pool.length,
    perfumes: ordered.slice(0, count).map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brandCn || p.brand,
      intensity: p.intensity,
      longevity: p.longevity,
      priceRange: p.priceRange,
      description: p.description,
    })),
  };
}

export function getTodayAdvice(count = 3) {
  return getAdvicePerfumes(getTodayStr(), count);
}
