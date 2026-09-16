/**
 * 埋点事件定义（客户端 / 服务端共用，无 'use client'，可安全被 API Route 引用）。
 *
 * 合规：全站无 PII。仅使用本地随机匿名 sessionId，不采集 IP / openid / 手机号 / 姓名。
 */

export const TRACK_EVENTS = [
  // —— 流量 ——
  'page_view', // 任意路由访问（PageTracker 自动）
  // —— 测试主漏斗 ——
  'test_start', // 落地页开始测试
  'question_view', // 单题曝光（带 step, phase, qid）—— 分步留存曲线的分母，答题页唯一能定位「掉在第几题」的事件
  'question_answer', // 单题作答（带 step, phase, qid, choice）
  'test_abandon', // 未完成即离开（带 step, phase）
  'test_complete', // 本人完成测试（带 personality）
  'result_view', // 查看示例 / 他人结果（带 source, personality）
  // —— 分享与病毒 ——
  'share_card_generate', // 请求生成分享图（带 scene, format）
  'share_guide_open', // 打开分享引导（带 context）
  'share_click', // 点击某个分享动作（带 channel）
  'download_card', // 用户真正拿到图（下载完成 / 已展示长按预览）
  'shared_landing_view', // /shared 落地页曝光（带 personality）—— 裂变分母
  'shared_cta_click', // /shared 落地页 CTA 点击（带 cta）—— 裂变转化，K 因子分子
  // —— 好友 / 合香 ——
  'friend_match_start',
  'friend_match_complete', // 带 tier
  // —— 今日香签 ——
  'daily_draw', // 抽签（带 sign）
  'codex_view', // 香气图鉴
  // —— 付费漏斗 ——
  'paywall_view', // 付费墙曝光（带 context, price）—— 漏斗真正的起点，此前缺失导致看板从「弹窗打开」起算
  'pay_modal_open', // 解锁弹窗曝光（带 context, price）
  'pay_claim', // 点击「去支付」（带 price, context）
  'pay_modal_close', // 主动关闭解锁弹窗（带 context, price）—— 弹窗内流失
  'unlock_success', // 解锁成功（带 level）
] as const;

export type TrackEvent = (typeof TRACK_EVENTS)[number];

export const EVENT_SET: ReadonlySet<string> = new Set(TRACK_EVENTS as readonly string[]);

/**
 * 事件中文展示名（后台看板 + CSV 导出共用）。
 *
 * 2026-09-16：原先 `app/api/admin/overview/route.ts` 与 `app/admin/AdminDashboard.tsx`
 * 各自维护一份，加事件时常漏改其中一处（`pay_method_select` 就是典型：删了定义、
 * 两份标签还留着）。现在统一放在这里，只此一份。
 * ⚠️ 新增事件时务必同时补这里 —— scripts/audit-analytics.ts 会断言全覆盖。
 */
export const EVENT_LABEL: Record<string, string> = {
  page_view: '页面访问',
  test_start: '开始测试',
  question_view: '题目曝光',
  question_answer: '题目作答',
  test_abandon: '中途离开',
  test_complete: '完成测试',
  result_view: '查看他人结果',
  share_card_generate: '生成分享图',
  share_guide_open: '打开分享引导',
  share_click: '点击分享',
  download_card: '下载分享图',
  shared_landing_view: '分享页访问',
  shared_cta_click: '分享页点击',
  friend_match_start: '好友匹配开始',
  friend_match_complete: '好友匹配完成',
  daily_draw: '香签揭笺',
  codex_view: '香气图鉴',
  paywall_view: '付费墙曝光',
  pay_modal_open: '解锁弹窗曝光',
  pay_claim: '点击去支付',
  pay_modal_close: '关闭付费弹窗',
  unlock_success: '解锁成功',
};

/** 参与分维度聚合的 props key（其余 props 只留在原始事件流里）
 *
 * ⚠️ 这份清单是「唯一真源」：lib/analytics/store.ts 读取时直接复用 DIM_KEYS，
 * 不再手工维护第二份 READ_DIMS（历史上两者漏同步 —— READ_DIMS 少了 format,
 * 导致 KV 驱动与 Supabase 驱动的维度口径不一致，还不报错）。
 * 新增维度只需在这里加一处。 */
export const DIM_KEYS = [
  'path',
  'personality',
  'ref',
  'method',
  'price',
  'scene',
  'tier',
  'format',
  'source',
  'channel',
  'context',
  'sign',
  'level',
  // —— 答题漏斗（2026-09-16 新增）——
  'step', // 第几步（分支题 1-7 + 校准题 8-10）
  'phase', // branch | calibration
  'qid', // 题目 id（q1 / q5a / cal1 …）
  'choice', // 选中项 id（q1a / cal1b …）
  // —— 裂变落地页 ——
  'cta', // 落地页按钮标识（start_test / match / copy_link / save_image / qr / my_result）
] as const;

export type DimKey = (typeof DIM_KEYS)[number];

export type PropValue = string | number | boolean;

const MAX_STR = 64;
const MAX_KEY = 32;

/** 清洗 props：只留标量、key 限字符集、value 限长度，杜绝敏感字段注入。 */
export function sanitizeProps(input: unknown): Record<string, PropValue> {
  const out: Record<string, PropValue> = {};
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    for (const [rawKey, v] of Object.entries(input as Record<string, unknown>)) {
      if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') continue;
      const key = String(rawKey);
      if (!/^[A-Za-z_][A-Za-z0-9_]{0,23}$/.test(key)) continue;
      out[key.slice(0, MAX_KEY)] = typeof v === 'string' ? v.slice(0, MAX_STR) : v;
    }
  }
  return out;
}

/** 归一化一条上报记录（事件白名单 + 字段清洗 + 长度截断） */
export function normalizeEvent(body: unknown): {
  event: TrackEvent;
  props: Record<string, PropValue>;
  sessionId: string;
  path: string;
  ts: number;
} | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const event = typeof b.event === 'string' ? b.event : '';
  if (!EVENT_SET.has(event)) return null;
  const props = sanitizeProps(b.props);
  // 顶层 ref（客户端已归一化为渠道名）并入 props，供分维度聚合
  if (typeof b.ref === 'string' && b.ref && props.ref === undefined) {
    props.ref = b.ref.slice(0, MAX_STR);
  }
  return {
    event: event as TrackEvent,
    props,
    sessionId: typeof b.sessionId === 'string' ? b.sessionId.slice(0, 64) : '',
    path: typeof b.path === 'string' ? b.path.slice(0, 200) : '',
    ts: typeof b.ts === 'number' && Number.isFinite(b.ts) ? b.ts : Date.now(),
  };
}

/** Asia/Shanghai 日期 key（YYYY-MM-DD） */
export function shanghaiDateKey(ts: number = Date.now()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(ts));
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

/** 把来源 URL 归一化成渠道名（不保存完整 URL，避免携带隐私参数） */
export function normalizeRef(ref: string | undefined, path: string): string {
  const raw = (ref || '').toLowerCase();
  if (!raw) return path && path !== '/' ? '内部直达' : '直接访问';
  if (raw.includes('weixin') || raw.includes('wechat') || raw.includes('mp.qq')) return '微信';
  if (raw.includes('xiaohongshu') || raw.includes('xhs')) return '小红书';
  if (raw.includes('douyin') || raw.includes('tiktok')) return '抖音';
  if (raw.includes('weibo')) return '微博';
  if (raw.includes('baidu')) return '百度';
  if (raw.includes('google')) return 'Google';
  if (raw.includes('bing')) return 'Bing';
  if (raw.includes('zhihu')) return '知乎';
  if (raw.includes('bilibili')) return 'B 站';
  if (raw.includes('qq.com')) return 'QQ';
  if (raw.includes('crushxiangjian.com')) return '站内';
  try {
    return new URL(ref || '').hostname.replace(/^www\./, '') || '其他';
  } catch {
    return '其他';
  }
}
