/**
 * 邀请链路状态协议 + 朋友页 URL 解析
 * 合并自原 invite.ts（朋友页用）+ inviteState.ts（结果页用）
 *
 * localStorage keys:
 * - crushxiangjian_invitee_status: Record<personalityName, 'pending'|'completed'>
 *   （A 的名字 → 状态）由朋友 B 写入，A 读取
 * - crushxiangjian_inviter_personality: string
 *   A 的名字，由结果页写入，自己读取
 */

import { STORAGE_KEYS, PERSONALITY_ID_MAP } from './personalities';

// ─────────────────────────────────────────
// 邀请状态常量
// ─────────────────────────────────────────

export const INVITE_KEYS = {
  STATUS: 'crushxiangjian_invitee_status',
  INVITER: 'crushxiangjian_inviter_personality',
} as const;

export type InviteStatus = 'pending' | 'completed';
export type InviteeStatusMap = Record<string, InviteStatus>;

// ─────────────────────────────────────────
// 邀请链接编解码（结果页 ↔ 朋友页共用）
// ─────────────────────────────────────────

/** base64 编码人格名（结果页复制邀请链接时用）*/
export function encodeInvite(personalityName: string): string {
  return btoa(unescape(encodeURIComponent(personalityName)));
}

/** base64 解码人格名（朋友页读 ?inv= 时用）*/
export function decodeInvite(encoded: string): string | null {
  try {
    const decoded = decodeURIComponent(escape(atob(encoded)));
    // 人格名必须在 16 人格里才算有效
    return PERSONALITY_ID_MAP[decoded] ? decoded : null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────
// localStorage 读写（朋友页用）
// ─────────────────────────────────────────

/**
 * 从 URL 参数 ?inv= 解码出邀请者人格名（朋友页用）
 */
export function getInviterIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const inv = params.get('inv');
  if (!inv) return null;
  return decodeInvite(inv);
}

/**
 * 读当前用户（我）的人格英文 ID（localStorage）
 * 对应 data.ts PERSONALITY_TYPES[].id
 */
export function getMyPersonalityId(): string | null {
  return localStorage.getItem(STORAGE_KEYS.PERSONALITY_ID);
}

// ─────────────────────────────────────────
// 邀请状态读写（朋友页 + 结果页共用）
// ─────────────────────────────────────────

/**
 * 读取所有邀请状态
 * 返回 { inviter, invitees, totalCompleted }
 */
export function getInviteState(): {
  inviter: string | null;
  invitees: Array<{ name: string; status: InviteStatus }>;
  totalCompleted: number;
} {
  if (typeof window === 'undefined') return { inviter: null, invitees: [], totalCompleted: 0 };
  const inviter = localStorage.getItem(INVITE_KEYS.INVITER);
  const raw = localStorage.getItem(INVITE_KEYS.STATUS);
  let parsed: InviteeStatusMap = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }
  const invitees = Object.entries(parsed).map(([name, status]) => ({
    name,
    status,
  }));
  const totalCompleted = invitees.filter((i) => i.status === 'completed').length;
  return { inviter, invitees, totalCompleted };
}

/**
 * 标记邀请者已完成测试（朋友页 B 答完题后调用）
 */
export function markInviteeCompleted(inviterPersonalityName: string): void {
  if (!inviterPersonalityName) return;
  const raw = localStorage.getItem(INVITE_KEYS.STATUS);
  let parsed: InviteeStatusMap = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }
  parsed[inviterPersonalityName] = 'completed';
  localStorage.setItem(INVITE_KEYS.STATUS, JSON.stringify(parsed));
}

/**
 * 标记邀请者已访问（点击链接但未完成，B 刚进朋友页时调用）
 */
export function markInviteePending(inviterPersonalityName: string): void {
  if (!inviterPersonalityName) return;
  const raw = localStorage.getItem(INVITE_KEYS.STATUS);
  let parsed: InviteeStatusMap = {};
  try {
    parsed = raw ? JSON.parse(raw) : {};
  } catch {
    parsed = {};
  }
  if (!(inviterPersonalityName in parsed)) {
    parsed[inviterPersonalityName] = 'pending';
    localStorage.setItem(INVITE_KEYS.STATUS, JSON.stringify(parsed));
  }
}

/**
 * 设置当前用户为邀请者（结果页初始化时调用）
 * 把自己的人格名记下来（用于判断这个设备是谁的）
 */
export function setAsInviter(personalityName: string): void {
  localStorage.setItem(INVITE_KEYS.INVITER, personalityName);
}

// ─────────────────────────────────────────
// 实时状态 Hook（结果页用）
// ─────────────────────────────────────────

import { useEffect, useState } from 'react';

/**
 * 实时订阅邀请状态（跨标签同步 + 本窗口 polling）
 * 结果页专用
 */
export function useInviteStatus(): {
  inviter: string | null;
  invitees: Array<{ name: string; status: InviteStatus }>;
  totalCompleted: number;
  canDiscount: boolean;
} {
  const [state, setState] = useState(getInviteState);

  useEffect(() => {
    const sync = () => setState(getInviteState());
    sync();
    // storage 事件：跨标签同步（必须是不同标签）
    window.addEventListener('storage', sync);
    // focus 事件：用户切回窗口时重新读
    window.addEventListener('focus', sync);
    // polling：同窗口每 2 秒查一次（storage 事件不触发同窗口）
    const interval = setInterval(sync, 2000);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
      clearInterval(interval);
    };
  }, []);

  return { ...state, canDiscount: state.totalCompleted >= 3 };
}

/**
 * 当前用户作为邀请者的状态摘要（结果页显示用）
 */
export function getSelfInviteStatus(): {
  hasInvitees: boolean;
  completedCount: number;
  canDiscount: boolean;
} {
  const { totalCompleted } = getInviteState();
  return {
    hasInvitees: totalCompleted > 0,
    completedCount: totalCompleted,
    canDiscount: totalCompleted >= 3,
  };
}

// ─────────────────────────────────────────
// 调试工具
// ─────────────────────────────────────────

export function clearInviteState(): void {
  localStorage.removeItem(INVITE_KEYS.STATUS);
  localStorage.removeItem(INVITE_KEYS.INVITER);
}
