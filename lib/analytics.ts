'use client';

/**
 * 轻量、无 PII 的事件埋点（客户端）。
 *
 * 合规原则（与项目「合规红线」一致）：
 * - 绝不采集个人身份信息（PII）：无姓名 / 手机号 / 微信 openid / 邮箱 / 精确 IP。
 * - 仅用本地随机生成的「匿名 sessionId」（存于 localStorage）做漏斗 / 留存去重，
 *   该 id 与任何真实身份无关，用户清缓存即重置。
 * - 来源（referrer）只在本地归一化为渠道名后上报，不上传完整 URL。
 *
 * 上报到 /api/event，由 lib/analytics/store 决定落地方式（Vercel KV / 本地文件 / 日志）。
 */

import { normalizeRef, type PropValue, type TrackEvent } from './analytics/events';

export type { TrackEvent };

const SESSION_KEY = 'cx_anon_session';
const REF_KEY = 'cx_anon_ref';
const ENDPOINT = '/api/event';

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = window.localStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `s_${Math.random().toString(36).slice(2)}_${Date.now()}`;
      window.localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

/**
 * 首次来源渠道：第一次进站时把 referrer 归一化后存进 sessionStorage，
 * 后续页面沿用首次来源，避免「直接访问」被重复计算、归因失真。
 */
function getRef(): string {
  if (typeof window === 'undefined') return '直接访问';
  try {
    let ref = window.sessionStorage.getItem(REF_KEY);
    if (!ref) {
      ref = normalizeRef(document.referrer, window.location.pathname);
      window.sessionStorage.setItem(REF_KEY, ref);
    }
    return ref;
  } catch {
    return '直接访问';
  }
}

/** 上报一个匿名事件。失败静默，绝不影响主流程。 */
export function track(event: TrackEvent, props: Record<string, PropValue> = {}): void {
  if (typeof window === 'undefined') return;
  const payload = {
    event,
    props,
    sessionId: getSessionId(),
    path: window.location.pathname,
    ref: getRef(),
    ts: Date.now(),
  };
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
    } else {
      void fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    /* 埋点异常不应中断用户体验 */
  }
}

export const ANALYTICS_EVENTS: TrackEvent[] = [
  'page_view',
  'test_start',
  'test_complete',
  'result_view',
  'share_card_generate',
  'share_guide_open',
  'share_click',
  'download_card',
  'friend_match_start',
  'friend_match_complete',
  'daily_draw',
  'codex_view',
  'pay_modal_open',
  'pay_method_select',
  'pay_claim',
  'unlock_success',
];
