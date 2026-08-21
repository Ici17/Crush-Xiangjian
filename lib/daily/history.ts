// ============================================================
// Crush香鉴 — 香气历 · 连续静候（本地留存层）
// ============================================================
//
// 设计要点（借 Habit-Tracker 的 streak + streak-freeze 思想，纯前端实现）：
//   - 「连续静候」天数：每天揭笺即记一笔，从今天/昨天往前数连续天数
//   - streak freeze（续签令牌）：断一日可自动用一枚令牌补上，优雅不焦虑，
//     不设惩罚、不制造焦虑，文案用「静候」而非「打卡」
//   - 里程碑发令牌：连续达 7 的倍数且令牌未满，赠 1 枚（上限 3）
//   - 称号徽章：按历史最长连续（best）授予，纯情绪/审美称谓
//   - 月历墨点：当月每日状态，已静候的日子按主香稀有度着色（常/雅/隐）
//
// 全部存 localStorage，零后端。日期运算用 UTC 整日，避免本地时区漂移。

import type { Rarity } from './draw';

const KEY = 'crush_daily_history';
const MAX_FREEZES = 3;

export interface HistoryState {
  visited: string[]; // 已静候日期 YYYY-MM-DD
  freezes: number; // 剩余续签令牌
  lastFreezeStreak: number; // 上次赠令牌时的连续天数基线
}

export type DayCellKind = 'empty' | 'today' | 'visited' | 'missed' | 'future';

export interface DayCell {
  day: number; // 0 = 占位
  kind: DayCellKind;
}

export interface StreakView {
  current: number; // 当前连续（含 freeze 补齐）
  best: number; // 历史最长连续
  freezes: number; // 剩余续签令牌
  title: { name: string; rank: number };
  monthGrid: DayCell[];
}

interface MarkResult {
  state: HistoryState;
  view: StreakView;
  frozeGap: boolean; // 本次是否消耗令牌补了断点
  grantedFreeze: boolean; // 本次是否获赠令牌
}

// ── 日期工具（UTC 整日） ──
function addDays(s: string, n: number): string {
  const [y, m, d] = s.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) + n * 86400000;
  const dt = new Date(t);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function loadState(): HistoryState {
  if (typeof window === 'undefined') return { visited: [], freezes: 0, lastFreezeStreak: 0 };
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const o = JSON.parse(raw) as Partial<HistoryState>;
      return {
        visited: Array.isArray(o.visited) ? o.visited : [],
        freezes: typeof o.freezes === 'number' ? o.freezes : 0,
        lastFreezeStreak: typeof o.lastFreezeStreak === 'number' ? o.lastFreezeStreak : 0,
      };
    }
  } catch {
    /* ignore */
  }
  return { visited: [], freezes: 0, lastFreezeStreak: 0 };
}

function saveState(s: HistoryState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

// 当前连续：今天已访问从今天起算；今天未访问从昨天起算（streak 保持到明天）
function computeCurrent(set: Set<string>, today: string): number {
  let cursor = set.has(today) ? today : addDays(today, -1);
  if (!set.has(cursor)) return 0;
  let count = 0;
  while (set.has(cursor)) {
    count++;
    cursor = addDays(cursor, -1);
  }
  return count;
}

// 历史最长连续
function computeBest(visited: string[]): number {
  if (!visited.length) return 0;
  const sorted = [...new Set(visited)].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (addDays(sorted[i - 1], 1) === sorted[i]) run++;
    else run = 1;
    if (run > best) best = run;
  }
  return best;
}

const TITLES: { min: number; name: string }[] = [
  { min: 365, name: '香气旧友' },
  { min: 100, name: '一缕成香' },
  { min: 30, name: '沉香客' },
  { min: 7, name: '初嗅' },
];

export function titleFor(best: number): { name: string; rank: number } {
  for (const t of TITLES) if (best >= t.min) return { name: t.name, rank: t.min };
  return { name: '初遇香气', rank: 0 };
}

function buildMonthGrid(set: Set<string>, today: string): DayCell[] {
  const [y, m] = today.split('-').map(Number);
  const mm = String(m).padStart(2, '0');
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstWd = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const cells: DayCell[] = [];
  for (let i = 0; i < firstWd; i++) cells.push({ day: 0, kind: 'empty' });
  for (let d = 1; d <= daysInMonth; d++) {
    const fd = `${y}-${mm}-${String(d).padStart(2, '0')}`;
    let kind: DayCellKind;
    if (fd === today) kind = 'today';
    else if (fd < today) kind = set.has(fd) ? 'visited' : 'missed';
    else kind = 'future';
    cells.push({ day: d, kind });
  }
  return cells;
}

function buildView(state: HistoryState, today: string): StreakView {
  const set = new Set(state.visited);
  return {
    current: computeCurrent(set, today),
    best: computeBest(state.visited),
    freezes: state.freezes,
    title: titleFor(computeBest(state.visited)),
    monthGrid: buildMonthGrid(set, today),
  };
}

/**
 * 记录今日静候（幂等）。处理断点补齐与里程碑赠令牌。
 * 仅在用户真正揭笺时调用（含「已揭重进」场景）。
 */
export function markVisited(date: string): MarkResult {
  const state = loadState();
  if (state.visited.includes(date)) {
    return { state, view: buildView(state, date), frozeGap: false, grantedFreeze: false };
  }

  const set = new Set(state.visited);
  let frozeGap = false;
  const yesterday = addDays(date, -1);
  // 断点补齐：昨天没静候，但前天有 → 用一枚令牌把昨天补上
  if (!set.has(yesterday) && state.freezes > 0) {
    const dayBefore = addDays(yesterday, -1);
    if (set.has(dayBefore)) {
      set.add(yesterday);
      state.freezes -= 1;
      frozeGap = true;
    }
  }
  set.add(date);
  state.visited = [...set].sort();

  const current = computeCurrent(set, date);
  let grantedFreeze = false;
  if (current >= state.lastFreezeStreak + 7 && state.freezes < MAX_FREEZES) {
    state.freezes += 1;
    state.lastFreezeStreak = Math.max(state.lastFreezeStreak, current);
    grantedFreeze = true;
  }

  saveState(state);
  return { state, view: buildView(state, date), frozeGap, grantedFreeze };
}

/** 仅计算视图（不写），用于未揭笺时也展示当月墨点 */
export function getStreakView(today: string): StreakView {
  return buildView(loadState(), today);
}

export const RARITY_DOT: Record<Rarity, string> = {
  chang: '#2C1810', // 墨
  ya: '#A8884E', // 赭
  yin: '#C9A227', // 亮金
};

export { MAX_FREEZES };
