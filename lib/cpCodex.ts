// ============================================================
// Crush香鉴 — 气味 CP 图鉴 · 点亮记录（本地）
// ============================================================
//
// 立场：纯收集、纯审美、纯免费。
//   - 图鉴 = 256 个有序「人格 A × 人格 B」配对格（16×16）
//   - 当你和朋友实际匹配出某对，对应格点亮（A×B 与 B×A 同亮，因合香对称）
//   - 不卖概率、不强制分享、不付费解锁——未相遇的格只是「未相遇」剪影
//
// 存储：localStorage `crushxiangjian_cp_codex` = string[] 形如 ["暗流|残温", ...]

import { PERSONALITIES } from '@/lib/personalities';

export const CP_CODEX_KEY = 'crushxiangjian_cp_codex';

/** 图鉴总格数（16×16 有序对）*/
export const CP_TOTAL = PERSONALITIES.length * PERSONALITIES.length;

/** 规范化一对名字为稳定 key（有序，保留方向以便点亮对应格）*/
export function cpKey(a: string, b: string): string {
  return `${a}|${b}`;
}

function readSet(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(CP_CODEX_KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function writeSet(set: Set<string>): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CP_CODEX_KEY, JSON.stringify(Array.from(set)));
}

/**
 * 点亮一对（对称双亮：A×B 与 B×A 同时点亮）
 * 同名（本命自调）也记录。
 */
export function markCpLit(a: string, b: string): void {
  if (!a || !b) return;
  const set = readSet();
  set.add(cpKey(a, b));
  set.add(cpKey(b, a));
  writeSet(set);
}

/** 某对是否已点亮 */
export function isCpLit(a: string, b: string): boolean {
  return readSet().has(cpKey(a, b));
}

/** 当前已点亮格数（有序对去重计数，含对称重复）*/
export function getCpLitCount(): number {
  return readSet().size;
}

/** 全部已点亮的 key 列表 */
export function getCpLitKeys(): string[] {
  return Array.from(readSet());
}

/** 调试用：清空图鉴 */
export function clearCpCodex(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CP_CODEX_KEY);
}
