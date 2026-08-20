// ============================================================
// Crush香鉴 — 节气 · 月相 · 隐签之夜（合规玄学壳）
// ============================================================
//
// 立场：玄学的壳，审美的核。
//   - 节气/月相 = 诗意的氛围滤镜，不是命理/吉凶
//   - 「隐签之夜」= 二分二至 / 满月 / 新月 当天的一重仪式氛围，
//     内核仍是情绪与审美（一句启示体签文），无运势/转运/桃花表述
//   - 与每日香签同源：以「日期」为种子，全员当日共此一笺，利于传播
//
// 时区固定 Asia/Shanghai，与 lib/daily/draw.ts 一致。
// 注：节气为公历近似日（±1 天），月相为 synodic 近似——用于诗意氛围，非天文精确。

import { getTodayStr } from './draw';

// ── 24 节气近似日期（公历，±1 天） ──
const SOLAR_TERMS: { m: number; d: number; name: string }[] = [
  { m: 1, d: 6, name: '小寒' }, { m: 1, d: 20, name: '大寒' },
  { m: 2, d: 4, name: '立春' }, { m: 2, d: 19, name: '雨水' },
  { m: 3, d: 5, name: '惊蛰' }, { m: 3, d: 20, name: '春分' },
  { m: 4, d: 5, name: '清明' }, { m: 4, d: 20, name: '谷雨' },
  { m: 5, d: 5, name: '立夏' }, { m: 5, d: 21, name: '小满' },
  { m: 6, d: 5, name: '芒种' }, { m: 6, d: 21, name: '夏至' },
  { m: 7, d: 7, name: '小暑' }, { m: 7, d: 23, name: '大暑' },
  { m: 8, d: 7, name: '立秋' }, { m: 8, d: 23, name: '处暑' },
  { m: 9, d: 7, name: '白露' }, { m: 9, d: 23, name: '秋分' },
  { m: 10, d: 8, name: '寒露' }, { m: 10, d: 23, name: '霜降' },
  { m: 11, d: 7, name: '立冬' }, { m: 11, d: 22, name: '小雪' },
  { m: 12, d: 7, name: '大雪' }, { m: 12, d: 21, name: '冬至' },
];

// 二分二至（隐签之夜的关键节气）
const CROSS_QUARTER = new Set(['春分', '夏至', '秋分', '冬至']);

// ── 月相（synodic month 近似，8 相） ──
const MOON_NAMES = ['新月', '娥眉月', '上弦月', '盈凸月', '满月', '亏凸月', '下弦月', '残月'];
const SYNODIC = 29.530588853;
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14); // 2000-01-06 新月（参考锚点）

// ── FNV-1a 字符串哈希 → uint32 ──
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 取当天命中的节气名（无则 null） */
export function getSolarTerm(dateStr: string): string | null {
  const [, m, d] = dateStr.split('-').map(Number);
  for (const t of SOLAR_TERMS) {
    if (t.m === m && t.d === d) return t.name;
  }
  return null;
}

/**
 * 取当天月相。
 * name/index：8 相展示位（0=新月 4=满月）；
 * exact：是否为「精确正日」——满月/新月各只取最贴近的那 1 天（±0.5 天窗口），
 *        让「隐签之夜」保有稀缺仪式感，而非整个相位期连续多日触发。
 */
export function getMoonPhase(dateStr: string): { name: string; index: number; exact: 'full' | 'new' | null } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const days = (Date.UTC(y, m - 1, d) - NEW_MOON_EPOCH) / 86400000;
  const age = ((days % SYNODIC) + SYNODIC) % SYNODIC;
  const index = Math.round((age / SYNODIC) * 8) % 8;

  const distToFull = Math.abs(age - SYNODIC / 2);
  const distToNew = Math.min(age, SYNODIC - age);
  let exact: 'full' | 'new' | null = null;
  if (distToFull < 0.5) exact = 'full';
  else if (distToNew < 0.5) exact = 'new';

  return { name: MOON_NAMES[index], index, exact };
}

// ── 隐签之夜签文（启示体 · 合规） ──
const TERM_LINES: Record<string, string> = {
  春分: '昼夜均分，愿你也匀一点温柔给自己。',
  夏至: '白昼最长，光多到可以分给别人一点。',
  秋分: '凉意渐起，记得把心事裹暖一些。',
  冬至: '夜最长，正好把一年的光收进口袋。',
};

const FULL_MOON_LINES: string[] = [
  '月满，宜把没说出口的话，轻轻放下。',
  '满月照见心事，也照见你本来的样子。',
  '今夜月圆，适合与远方的人共此一轮。',
];

const NEW_MOON_LINES: string[] = [
  '新月如钩，适合在心里埋一颗种子。',
  '月始亏盈，一切都是刚开始的样子。',
  '新月很轻，轻到可以重新开始。',
];

export interface NightMood {
  term: string | null;   // 节气名（命中则非 null）
  moon: string;          // 月相名
  moonIndex: number;     // 0-7
  hidden: boolean;       // 是否「隐签之夜」
  badge: string;         // 标签文案（如「春分 · 满月」）
  line: string;          // 隐签（启示体，仅在 hidden 时有意义）
}

/**
 * 以日期为种子的「隐签之夜」判定与氛围文案。
 * 同一 date 永远返回相同结果（与 drawDaily 同源，可服务端复算）。
 */
export function getNightMood(dateStr: string = getTodayStr()): NightMood {
  const term = getSolarTerm(dateStr);
  const { name: moon, index: moonIndex, exact } = getMoonPhase(dateStr);

  const isCrossQuarter = !!term && CROSS_QUARTER.has(term);
  const isFull = exact === 'full';
  const isNew = exact === 'new';
  const hidden = isCrossQuarter || isFull || isNew;

  // 标签：节气与特殊月相叠加展示，其余不打扰
  let badge = '';
  if (isCrossQuarter && (isFull || isNew)) badge = `${term} · ${moon}`;
  else if (isCrossQuarter) badge = term!;
  else if (isFull) badge = '满月';
  else if (isNew) badge = '新月';

  // 签文优先级：二分二至 > 满月 > 新月
  let line = '';
  if (isCrossQuarter && term) {
    line = TERM_LINES[term] ?? '';
  } else if (isFull) {
    line = FULL_MOON_LINES[hashStr(`crush-night-full-${dateStr}`) % FULL_MOON_LINES.length];
  } else if (isNew) {
    line = NEW_MOON_LINES[hashStr(`crush-night-new-${dateStr}`) % NEW_MOON_LINES.length];
  }

  return { term, moon, moonIndex, hidden, badge, line };
}
