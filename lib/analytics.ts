'use client';

/**
 * 轻量、无 PII 的事件埋点（客户端）。
 *
 * 合规原则（与项目「合规红线」一致）：
 * - 绝不采集个人身份信息（PII）：无姓名 / 手机号 / 微信 openid / 邮箱 / 精确 IP / UA 指纹。
 * - 仅用本地随机生成的匿名 ID 做漏斗 / 留存去重，与任何真实身份无关，清缓存即重置。
 * - 来源（referrer）只在本地归一化为渠道名后上报，不上传完整 URL。
 *
 * 第 2 批（2026-09-16）增量：
 * - 两层 ID：`cx_vid`（长期访客）与 `cx_sid` + `cx_sid_ts`（30 分钟滚动会话）。
 *   会话键用 localStorage 而非 sessionStorage —— sessionStorage 每标签独立，
 *   会把同一用户的两个标签算成两个会话，且无法跨标签共享「最近活动时间」。
 * - 新会话首触自动补发 `session_start`（ts-1 保证排在当前事件之前），调用点无需手动埋。
 * - 上报失败兜底：sendBeacon 返回值 / fetch res.ok 任一失败即入本地队列，联网后补发。
 * - 幂等：每条 payload 带 `eid`，服务端按 eid 去重，避免重发造成重复上报。
 *
 * 上报到 /api/event，由 lib/analytics/store 决定落地方式（Supabase / Vercel KV / 本地文件 / 日志）。
 */

import {
  normalizeRef,
  shanghaiDateKey,
  TRACK_EVENTS,
  type PropValue,
  type TrackEvent,
} from './analytics/events';

export type { TrackEvent };

// —— 身份与来源 ——
const VID_KEY = 'cx_vid'; // 访客（长期）
const SID_KEY = 'cx_sid'; // 会话（30 分钟滚动）
const SID_TS_KEY = 'cx_sid_ts'; // 最近活动时间戳（ms）
const LEGACY_SESSION_KEY = 'cx_anon_session'; // 旧键：历史语义即「长期访客」
const REF_KEY = 'cx_anon_ref'; // 首触来源（sessionStorage，单标签）
const ENDPOINT = '/api/event';

// —— 会话窗口 ——
const WINDOW_MS = 30 * 60 * 1000; // 30 分钟

// —— 兜底队列 ——
const QUEUE_KEY = 'cx_ev_queue';
const DROPPED_KEY = 'cx_ev_dropped';
const QUEUE_MAX = 40; // 条数上限
const QUEUE_MAX_BYTES = 128 * 1024; // 字节上限（先到为准）

// —— 限流 ——
const FLUSH_MIN_INTERVAL = 15 * 1000; // 最小间隔 15s
const FLUSH_BATCH = 10; // 单批最多 10 条
const FLUSH_BACKOFF = 30 * 1000; // 一次失败后退避 30s

/** 上报 payload。身份键永远走顶层，绝不进 props / DIM_KEYS。 */
type Payload = {
  event: string;
  props: Record<string, PropValue>;
  vid: string;
  sid: string;
  eid?: string;
  path: string;
  ref: string;
  ts: number;
};

// ============================================================
// 基础工具（所有 Storage / crypto 访问一律 try/catch —— 隐私模式下会抛异常）
// ============================================================

function lsGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function lsSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* 隐私模式 / 配额满：忽略，绝不影响主流程 */
  }
}

function genId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* fallthrough */
  }
  return `s_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

function rand8(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const a = new Uint8Array(6);
      crypto.getRandomValues(a);
      let s = '';
      for (const b of a) s += b.toString(36).padStart(2, '0');
      return s.slice(0, 8);
    }
  } catch {
    /* fallthrough */
  }
  return Math.random().toString(36).slice(2).padEnd(8, '0').slice(0, 8);
}

/** 幂等 id：base36 时间 + 随机后缀 */
function genEid(): string {
  return `${Date.now().toString(36)}-${rand8()}`;
}

/** 长期访客 ID。迁移：优先 cx_vid；缺失则采纳旧键 cx_anon_session 的值，保证老访客 UV 连续。 */
function getVisitorId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let v = lsGet(VID_KEY);
    if (!v) {
      v = lsGet(LEGACY_SESSION_KEY) || genId();
      lsSet(VID_KEY, v);
    }
    return v;
  } catch {
    return '';
  }
}

/**
 * 解析 / 刷新会话：返回当前 sid、vid 及是否为新会话。
 * 30 分钟滚动窗口：每次活动都刷新 cx_sid_ts，窗口内不切会话。
 */
function ensureSession(): { sid: string; vid: string; isNewSession: boolean } {
  const vid = getVisitorId();
  const now = Date.now();
  try {
    const sid = lsGet(SID_KEY);
    const last = Number(lsGet(SID_TS_KEY) || 0);
    const isNew = !sid || !last || now - last > WINDOW_MS;
    const nextSid = isNew ? genId() : (sid as string);
    lsSet(SID_KEY, nextSid);
    lsSet(SID_TS_KEY, String(now)); // 滚动刷新（含同一会话内的每次事件）
    return { sid: nextSid, vid, isNewSession: isNew };
  } catch {
    return { sid: '', vid, isNewSession: false };
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

// ============================================================
// 兜底队列（localStorage cx_ev_queue）
// ============================================================

function readQueue(): Payload[] {
  try {
    const raw = lsGet(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is Payload => !!x && typeof x === 'object' && typeof (x as Payload).event === 'string',
    );
  } catch {
    return [];
  }
}

function writeQueue(q: Payload[]): void {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  } catch {
    /* 配额满：放弃队列持久化，避免阻塞主流程 */
  }
}

function bumpDropped(): void {
  try {
    const n = Number(lsGet(DROPPED_KEY) || 0) + 1;
    lsSet(DROPPED_KEY, String(n));
  } catch {
    /* ignore */
  }
}

/**
 * 真字节数（UTF-8）。`String.length` 是 UTF-16 码元数，中文 props 下会与字节数差 ~3 倍，
 * 直接用 `.length` 比 `QUEUE_MAX_BYTES` 会名不副实（上限偏松）。TextEncoder 不可用时
 * 退回码元数（仅近似，绝不抛错）。
 */
function utf8Len(s: string): number {
  try {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length;
  } catch {
    /* fallthrough */
  }
  return s.length;
}

/**
 * 入队。递归防护：`error` 事件自身绝不入队 —— 否则「队列溢出 → 报 error →
 * error 又入队 → 再次溢出」会形成死循环。
 */
function enqueue(payload: Payload): void {
  if (!payload || payload.event === 'error') return;
  const q = readQueue();
  q.push(payload);
  let dropped = false;
  // 条数上限：先到为准，溢出丢最旧
  while (q.length > QUEUE_MAX) {
    q.shift();
    dropped = true;
  }
  // 字节上限：先到为准。用真字节数判断；先把各条序列化一次并累计总长，
  // 每次 shift 只减去被移除项的长度与一个逗号，避免循环里反复 stringify / 编码（O(n²)）。
  try {
    const parts = q.map((p) => JSON.stringify(p));
    let total = 2; // "[" + "]"
    for (const s of parts) total += utf8Len(s);
    if (parts.length > 1) total += parts.length - 1; // 逗号数 = n - 1
    while (q.length > 0 && total > QUEUE_MAX_BYTES) {
      const n = q.length;
      total -= utf8Len(parts.shift() as string);
      if (n > 1) total -= 1; // 少一个逗号
      q.shift();
      dropped = true;
    }
  } catch {
    /* ignore */
  }
  writeQueue(q);
  if (dropped) {
    bumpDropped();
    reportError('queue_drop');
  }
}

// ============================================================
// 发送（直发 + 失败入队）
// ============================================================

/** 逐条 sendBeacon；返回是否入队成功（false = 未投递）。 */
function beaconOnce(payload: Payload): boolean {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      return navigator.sendBeacon(ENDPOINT, blob);
    }
  } catch {
    /* fallthrough */
  }
  return false;
}

function queueIfAllowed(payload: Payload): void {
  if (payload.event === 'error') return; // 递归防护
  enqueue(payload);
}

/** 尝试直接投递；失败则入队（error 除外）。 */
function deliver(payload: Payload): void {
  const body = JSON.stringify(payload);

  // 1) sendBeacon —— 必须检查返回值：返回 false ＝ 入队失败
  let beaconOk = false;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      beaconOk = navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
    }
  } catch {
    beaconOk = false;
  }
  if (beaconOk) {
    scheduleFlush(); // 直接发送成功 → 顺手清一次积压
    return;
  }

  // 2) fetch 兜底 —— 必须判断 res.ok
  try {
    if (typeof fetch === 'function') {
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
      })
        .then((res) => {
          if (res.ok) scheduleFlush();
          else queueIfAllowed(payload);
        })
        .catch(() => queueIfAllowed(payload));
      return;
    }
  } catch {
    /* fallthrough */
  }

  // 3) 都不可用 → 入队
  queueIfAllowed(payload);
}

// ============================================================
// drain（限流 + 串行化 + 退避）
// ============================================================

let flushing = false; // 模块级布尔：串行化 drain，防重入
let lastFlushAt = 0;
let backoffUntil = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush(): void {
  try {
    if (flushTimer) return;
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush();
    }, 0);
  } catch {
    /* ignore */
  }
}

async function flush(): Promise<void> {
  if (flushing) return;
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now < backoffUntil) return;
  if (now - lastFlushAt < FLUSH_MIN_INTERVAL) return;
  const q = readQueue();
  if (!q.length) return;

  flushing = true;
  try {
    lastFlushAt = Date.now();
    const batch = q.slice(0, FLUSH_BATCH);
    const rest = q.slice(batch.length);

    // 逐条 sendBeacon，失败即中止本轮（保序、避免雪崩）
    let sentCount = 0;
    let failed = false;
    for (const payload of batch) {
      if (beaconOnce(payload)) sentCount += 1;
      else {
        failed = true;
        break;
      }
    }
    // 未发出的（含失败那条）按原序回填，绝不丢
    writeQueue(batch.slice(sentCount).concat(rest));

    if (failed) {
      backoffUntil = Date.now() + FLUSH_BACKOFF;
      reportError('flush_fail');
    }
  } catch {
    backoffUntil = Date.now() + FLUSH_BACKOFF;
  } finally {
    flushing = false;
  }
}

// ============================================================
// 兜底可观测：最小 error 事件（仅 scope=analytics，绝不含错误文本 / 堆栈 / URL）
// ============================================================

function reportError(status: 'queue_drop' | 'flush_fail'): void {
  if (typeof window === 'undefined') return;
  try {
    const { sid, vid } = ensureSession();
    deliver({
      event: 'error',
      props: { scope: 'analytics', status },
      vid,
      sid,
      path: window.location.pathname,
      ref: getRef(),
      eid: genEid(),
      ts: Date.now(),
    });
  } catch {
    /* ignore */
  }
}

// ============================================================
// 对外 API
// ============================================================

/** 上报一个匿名事件。失败静默并入队，绝不影响主流程。 */
export function track(event: TrackEvent, props: Record<string, PropValue> = {}): void {
  if (typeof window === 'undefined') return;
  try {
    const { sid, vid, isNewSession } = ensureSession();
    const base = { vid, sid, path: window.location.pathname, ref: getRef() };
    const now = Date.now();
    // 新会话：先补一条 session_start（ts-1 保证排在当前事件之前），调用点无需手动埋。
    // 跨天钳制：若 now 恰是 Shanghai 00:00:00.000，now-1 会落到前一天，
    // 而 store 按 shanghaiDateKey(ts) 算 day 列 → 会话锚点会被记进前一天。
    // 故仅在 ts-1 仍属同一天时才减 1，否则退回 now（放弃 1ms 排序收益，视觉影响可忽略）。
    if (isNewSession) {
      const tsStart = shanghaiDateKey(now - 1) === shanghaiDateKey(now) ? now - 1 : now;
      deliver({ event: 'session_start', props: {}, ...base, eid: genEid(), ts: tsStart });
    }
    deliver({ event, props, ...base, eid: genEid(), ts: now });
  } catch {
    /* 埋点异常不应中断用户体验 */
  }
}

// 重发时机：上线即刷 / 后台化即刷 / 加载即刷
if (typeof window !== 'undefined') {
  try {
    window.addEventListener('online', () => {
      void flush();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') void flush();
    });
    scheduleFlush();
  } catch {
    /* ignore */
  }
}

/**
 * 全量事件名（供后台 / 脚本做覆盖度校验）。
 *
 * 2026-09-16：此处原是一份手工复制的常量数组，与 TRACK_EVENTS 完全重复 ——
 * 加事件时极易只改一处，现已改为直接复用定义。
 */
export const ANALYTICS_EVENTS: readonly TrackEvent[] = TRACK_EVENTS;
