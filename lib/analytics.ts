'use client';

/**
 * 轻量、无 PII 的事件埋点。
 *
 * 合规原则（与项目「合规红线」一致）：
 * - 绝不采集个人身份信息（PII）：无姓名 / 手机号 / 微信 openid / 邮箱 / 精确 IP。
 * - 仅用本地随机生成的「匿名 sessionId」（存于 localStorage）做漏斗 / 留存去重，
 *   该 id 与任何真实身份无关，用户清缓存即重置。
 * - 服务端 /api/event 亦不会读取可识别字段（不读请求 IP）。
 *
 * 设计取舍：当前零配置即可运行（事件打到 Vercel 函数日志）；
 * 配置 Upstash Redis 环境变量后自动升级为可聚合的真实埋点库。
 */

export type TrackEvent =
  | 'page_view' // 任意路由访问（由 PageTracker 自动上报）
  | 'test_start' // 落地页点击「开始寻找我的本命香」
  | 'test_complete' // 用户本人完成测试（结果页读 localStorage 分支）
  | 'result_view' // 通过 ?p= 查看示例/他人结果（病毒触达，非转化）
  | 'share_card_generate' // 生成分享图（六维卡）
  | 'friend_match_start' // 进入好友匹配页
  | 'friend_match_complete'; // 匹配结果算出

const SESSION_KEY = 'cx_anon_session';
const ENDPOINT = '/api/event';
const MAX_STR_PROP = 64;

function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = window.localStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `s_${Math.random().toString(36).slice(2)}_${Date.now()}`);
      window.localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
}

type PropValue = string | number | boolean;

/** 上报一个匿名事件。失败静默，绝不影响主流程。 */
export function track(event: TrackEvent, props: Record<string, PropValue> = {}): void {
  if (typeof window === 'undefined') return;
  const payload = {
    event,
    props,
    sessionId: getSessionId(),
    path: window.location.pathname,
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
  'friend_match_start',
  'friend_match_complete',
];

export { MAX_STR_PROP };
