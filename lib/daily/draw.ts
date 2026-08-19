// ============================================================
// Crush香鉴 — 今日香签 · 确定性抽签
// ============================================================
//
// 设计要点：
//   - 以「日期」为唯一种子，全员当日抽到同一组签（共此一笺，利于传播）
//   - 1 主香 + 2 启示签，三签各自独立稀有度（常 / 雅 / 隐）
//   - 纯函数、无副作用、可服务端/客户端复算（分享卡与页面结果一致）
//   - 话术定位「今日启示/灵感」，不涉及运势/命中注定
//
// 时区固定 Asia/Shanghai，避免跨零点用户抽到不同签。

import { PERFUMES, type Perfume } from "../data";

export type Rarity = "chang" | "ya" | "yin";

export interface DrawnPerfume {
  name: string;
  brand: string;
  brandCn: string;
  notes: { top: string[]; heart: string[]; base: string[] };
  description: string;
  rarity: Rarity;
}

export interface DailyDraw {
  date: string; // YYYY-MM-DD (Asia/Shanghai)
  main: DrawnPerfume; // 主香
  inspirations: [DrawnPerfume, DrawnPerfume]; // 2 启示签
}

// 稀有度 → 金印文字（常 = 无印）
export const RARITY_LABEL: Record<Rarity, string> = {
  chang: "",
  ya: "雅",
  yin: "隐",
};

// ── FNV-1a 字符串哈希 → uint32 ──
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// ── mulberry32 确定性伪随机 ──
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Asia/Shanghai 日期字符串 ──
export function getTodayStr(d: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d).reduce<Record<string, string>>((acc, p) => {
    acc[p.type] = p.value;
    return acc;
  }, {});
  return `${parts.year}-${parts.month}-${parts.day}`;
}

// 稀有度滚动：常 60% / 雅 30% / 隐 10%
function rollRarity(rng: () => number): Rarity {
  const r = rng();
  if (r < 0.6) return "chang";
  if (r < 0.9) return "ya";
  return "yin";
}

function toDrawn(p: Perfume, rng: () => number): DrawnPerfume {
  return {
    name: p.name,
    brand: p.brand,
    brandCn: p.brandCn,
    notes: p.notes,
    description: p.description,
    rarity: rollRarity(rng),
  };
}

/**
 * 以日期为种子的确定性抽签。
 * 同一 date 永远返回相同结果（服务端分享卡与客户端页面一致）。
 */
export function drawDaily(dateStr: string = getTodayStr()): DailyDraw {
  const names = Object.keys(PERFUMES);
  const rng = mulberry32(hashStr(`crush-daily-${dateStr}`));

  // Fisher-Yates 洗牌（副本）
  const pool = names.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const picked = pool.slice(0, 3).map((id) => PERFUMES[id]);
  const main = toDrawn(picked[0], rng);
  const inspirations: [DrawnPerfume, DrawnPerfume] = [
    toDrawn(picked[1], rng),
    toDrawn(picked[2], rng),
  ];

  return { date: dateStr, main, inspirations };
}
