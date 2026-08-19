// ============================================================
// Crush香鉴 — 今日宜忌 · 合规玄学壳
// ============================================================
//
// 立场：玄学的壳，审美的核。
//   - 宜/忌 = 今日的情绪/行动建议，定位「审美与心境」，不是吉凶祸福
//   - 绝不出现：转运/改命/破灾/招桃花/宜投资/忌出行 等迷信或风险暗示
//   - 与每日香签同源：以「日期」为种子，全员当日共此一笺，利于传播
//
// 时区固定 Asia/Shanghai，与 lib/daily/draw.ts 一致。

import { getTodayStr } from './draw';

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

// 今日宜：情绪/审美的「可做之事」（无吉凶）
const YI_POOL: string[] = [
  '留白',
  '慢下来',
  '让某种气息替你说话',
  '给旧事一个温柔的句号',
  '认真闻一次风',
  '把心事写进别处',
  '允许自己不被理解',
  '为一束光停步',
  '给远方的人寄一句',
  '把今天过成一首短诗',
  '收藏一个微不足道的瞬间',
  '对自己诚实一次',
  '在喧嚣里守住安静',
  '重读一封旧信',
  '让想念自然流动',
  '选一支陪你的香',
];

// 今日忌：情绪/审美的「可缓之事」（无吉凶、无风险暗示）
const JI_POOL: string[] = [
  '向谁解释',
  '急着要答案',
  '把情绪说得太满',
  '为合群稀释自己',
  '用忙碌逃避感受',
  '替别人承担情绪',
  '在深夜做决定',
  '把委屈说成懂事',
  '反复确认别人爱不爱',
  '把期待全押在一件事',
  '用抱歉填满沉默',
  '为还没发生的事焦虑',
  '把喜欢藏得太深',
  '和过去较劲',
  '用理性掐灭直觉',
  '假装一切都好',
];

// 今日一语：写给自己的一句（启示体）
const NOTE_POOL: string[] = [
  '今日宜做自己的天气。',
  '你不需要被读懂，才值得被爱。',
  '有些安静，比热闹更接近你。',
  '给今天留一点余地，给明天的自己。',
  '香气记得你，比记忆更诚实。',
  '慢一点，世界不会因此离开你。',
  '你身上有种说不清的特别。',
  '今日，把温柔留一份给自己。',
];

export interface DailyAlmanac {
  date: string; // YYYY-MM-DD (Asia/Shanghai)
  yi: string[]; // 宜（3 条）
  ji: string[]; // 忌（3 条）
  note: string; // 今日一语
}

function pick<T>(arr: T[], rng: () => number, n: number): T[] {
  const pool = arr.slice();
  const out: T[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    const j = Math.floor(rng() * pool.length);
    out.push(pool.splice(j, 1)[0]);
  }
  return out;
}

/**
 * 以日期为种子的确定性宜忌。
 * 同一 date 永远返回相同结果（与 drawDaily 同源，服务端分享卡可复算）。
 */
export function drawAlmanac(dateStr: string = getTodayStr()): DailyAlmanac {
  const rng = mulberry32(hashStr(`crush-almanac-${dateStr}`));
  return {
    date: dateStr,
    yi: pick(YI_POOL, rng, 3),
    ji: pick(JI_POOL, rng, 3),
    note: NOTE_POOL[Math.floor(rng() * NOTE_POOL.length)],
  };
}
