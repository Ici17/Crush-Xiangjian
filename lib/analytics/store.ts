/**
 * 埋点存储层（仅服务端使用）。
 *
 * 四档驱动，自动探测，无需改代码：
 *  1. supabase —— 配了 SUPABASE_URL + key → 写入 Postgres（线上真实持久化，可 SQL 查询）
 *  2. kv       —— 配了 Vercel KV / Upstash Redis 环境变量 → 写入 Redis
 *  3. file     —— 本地开发兜底，写入 .data/analytics.json（Vercel 上不持久，仅 dev 用）
 *  4. log      —— 都没有时，仅打函数日志（保持旧行为，绝不报错影响主流程）
 *
 * 合规：不读请求 IP、不存任何 PII；只存匿名 sessionId（前端随机生成，无 Cookie、无指纹）。
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  DIM_KEYS,
  shanghaiDateKey,
  type DimKey,
  type PropValue,
} from './events';

export type StoredEvent = {
  event: string;
  props: Record<string, PropValue>;
  sessionId: string;
  path: string;
  ts: number;
  receivedAt: number;
};

export type DayBucket = {
  counts: Record<string, number>;
  dims: Partial<Record<DimKey, Record<string, number>>>;
  uv: number;
  nv: number;
};

export type DayResult = DayBucket & { date: string };

export type Driver = 'supabase' | 'kv' | 'file' | 'log';

export type RangeResult = {
  driver: Driver;
  from: string;
  to: string;
  days: DayResult[];
  recent: StoredEvent[];
  /** 区间内去重后的匿名访客数（跨天合并基数） */
  intervalUv: number;
  /** 单批次读取的行数上限截断标记（仅 Supabase 驱动有意义） */
  truncated?: boolean;
};

type PropValueLike = string | number | boolean;

// ============================================================
// Supabase Postgres（PostgREST，零依赖 fetch）
// 建表脚本见 scripts/supabase-schema.sql
// ============================================================

const SB_URL =
  process.env.SUPABASE_URL ||
  process.env.SUPABASE_REST_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';
const SB_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  '';
const SB_TABLE = process.env.SUPABASE_ANALYTICS_TABLE || 'cx_events';
/** 单区间读取行数上限，防止极端量级下函数内存溢出 */
const SB_READ_LIMIT = 20000;

function sbReady(): boolean {
  return Boolean(SB_URL && SB_KEY);
}

async function sbRest<T = unknown>(
  pathname: string,
  init: RequestInit & { method?: string },
): Promise<T | null> {
  const res = await fetch(`${SB_URL.replace(/\/$/, '')}/rest/v1/${pathname}`, {
    ...init,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'content-type': 'application/json',
      Prefer: init.method === 'POST' ? 'return=minimal' : 'count=none',
      ...(init.headers as Record<string, string> | undefined),
    },
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`supabase ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  if (init.method === 'POST') return null;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ([] as T);
}

type SbRow = {
  ts: string;
  day: string;
  event: string;
  path: string | null;
  sid: string | null;
  props: Record<string, PropValueLike> | null;
};

// ============================================================
// KV（Upstash REST）—— 零依赖，用 fetch 调 REST API
// ============================================================

const KV_URL =
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  process.env.KV_URL ||
  '';
const KV_TOKEN =
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  '';

export function currentDriver(): Driver {
  if (sbReady()) return 'supabase';
  if (KV_URL && KV_TOKEN) return 'kv';
  return 'file';
}

async function kvCall<T = unknown>(cmd: unknown[]): Promise<T | null> {
  const res = await fetch(`${KV_URL}/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(cmd),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`kv ${res.status}`);
  const json = (await res.json()) as { result?: T; error?: string };
  if (json.error) throw new Error(json.error);
  return (json.result ?? null) as T;
}

async function kvPipeline(cmds: unknown[][]): Promise<Array<{ result?: unknown }>> {
  const res = await fetch(`${KV_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(cmds),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`kv pipeline ${res.status}`);
  return (await res.json()) as Array<{ result?: unknown }>;
}

// ============================================================
// 文件驱动（本地 dev）
// ============================================================

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'analytics.json');

type FileShape = {
  events: StoredEvent[];
  days: Record<string, DayBucket & { uvSet?: Record<string, 1> }>;
  uvAll?: Record<string, 1>;
};

let fileLock: Promise<unknown> = Promise.resolve();

async function readFile(): Promise<FileShape> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw) as FileShape;
    return {
      events: parsed.events ?? [],
      days: parsed.days ?? {},
      uvAll: parsed.uvAll ?? {},
    };
  } catch {
    return { events: [], days: {}, uvAll: {} };
  }
}

async function writeFile(data: FileShape): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(data), 'utf8');
}

function emptyBucket(): DayBucket & { uvSet: Record<string, 1> } {
  return { counts: {}, dims: {}, uv: 0, nv: 0, uvSet: {} };
}

// ============================================================
// 写入
// ============================================================

function dimValues(ev: StoredEvent): Array<[DimKey, string]> {
  const out: Array<[DimKey, string]> = [];
  if (ev.path) out.push(['path', ev.path]);
  for (const key of DIM_KEYS) {
    const v = ev.props?.[key];
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim()) out.push([key, v]);
    else if (typeof v === 'number' || typeof v === 'boolean') out.push([key, String(v)]);
  }
  return out;
}

/** 记录一条已清洗的事件。任何异常都必须吞掉，绝不影响用户主流程。 */
export async function recordEvent(ev: StoredEvent): Promise<void> {
  const driver = currentDriver();

  if (driver === 'supabase') {
    try {
      await sbRest(SB_TABLE, {
        method: 'POST',
        body: JSON.stringify({
          day: shanghaiDateKey(ev.ts),
          ts: new Date(ev.ts).toISOString(),
          event: ev.event,
          path: ev.path || null,
          sid: ev.sessionId || null,
          props: (ev.props ?? {}) as Record<string, PropValueLike>,
        }),
      });
      return;
    } catch (e) {
      console.error('[analytics] supabase write failed, fallback log', e);
    }
    console.log('[event]', JSON.stringify(ev));
    return;
  }

  if (driver === 'kv') {
    try {
      const day = shanghaiDateKey(ev.ts);
      const cmds: unknown[][] = [
        ['HINCRBY', `cx:d:${day}`, ev.event, 1],
        ['PFADD', `cx:d:${day}:uv`, ev.sessionId || `anon_${Math.random()}`],
        ['PFADD', 'cx:uv:all', ev.sessionId || `anon_${Math.random()}`],
        ['LPUSH', 'cx:ev', JSON.stringify(ev)],
        ['LTRIM', 'cx:ev', 0, 4999],
      ];
      for (const [k, v] of dimValues(ev)) {
        cmds.push(['HINCRBY', `cx:d:${day}:dim:${k}`, v, 1]);
      }
      const res = await kvPipeline(cmds);
      // PFADD cx:uv:all 返回 1 = 该匿名 session 首次出现 → 计为新访客
      if (res?.[2]?.result === 1 && ev.sessionId) {
        await kvCall(['HINCRBY', `cx:d:${day}`, '__new', 1]).catch(() => null);
      }
      return;
    } catch (e) {
      console.error('[analytics] kv write failed, fallback log', e);
    }
  }

  // file（本地 dev）
  try {
    fileLock = fileLock.then(async () => {
      const data = await readFile();
      const day = shanghaiDateKey(ev.ts);
      const bucket = (data.days[day] as DayBucket & { uvSet?: Record<string, 1> }) ?? emptyBucket();
      bucket.counts[ev.event] = (bucket.counts[ev.event] ?? 0) + 1;
      bucket.uvSet = bucket.uvSet ?? {};
      if (ev.sessionId && !bucket.uvSet[ev.sessionId]) {
        bucket.uvSet[ev.sessionId] = 1;
        bucket.uv += 1;
        data.uvAll = data.uvAll ?? {};
        if (!data.uvAll[ev.sessionId]) {
          data.uvAll[ev.sessionId] = 1;
          bucket.nv += 1;
        }
      }
      bucket.dims = bucket.dims ?? {};
      for (const [k, v] of dimValues(ev)) {
        bucket.dims[k] = bucket.dims[k] ?? {};
        bucket.dims[k]![v] = (bucket.dims[k]![v] ?? 0) + 1;
      }
      data.days[day] = bucket;
      data.events = [ev, ...data.events].slice(0, 5000);
      await writeFile(data);
    });
    await fileLock;
    return;
  } catch (e) {
    console.error('[analytics] file write failed', e);
  }

  console.log('[event]', JSON.stringify(ev));
}

// ============================================================
// 读取
// ============================================================

const READ_DIMS: DimKey[] = ['path', 'personality', 'ref', 'method', 'price', 'tier', 'scene', 'source', 'channel', 'context', 'sign', 'level'];

function dateKeys(days: number): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i -= 1) {
    out.push(shanghaiDateKey(now - i * 86400000));
  }
  return out;
}

function rowToEvent(r: SbRow): StoredEvent {
  const ts = Number.isFinite(Date.parse(r.ts)) ? Date.parse(r.ts) : Date.now();
  return {
    event: r.event,
    props: (r.props ?? {}) as Record<string, PropValue>,
    sessionId: r.sid ?? '',
    path: r.path ?? '',
    ts,
    receivedAt: ts,
  };
}

type AggBucket = {
  counts: Record<string, number>;
  dims: Partial<Record<DimKey, Record<string, number>>>;
  uv: number;
  nv: number;
  uvSet: Set<string>;
};

export async function readRange(days = 14): Promise<RangeResult> {
  const keys = dateKeys(days);
  const driver = currentDriver();

  if (driver === 'supabase') {
    const from = keys[0];
    const to = keys[keys.length - 1];
    const sel = 'ts,day,event,path,sid,props';
    const range = `day=gte.${from}&day=lte.${to}`;

    const rows =
      (await sbRest<SbRow[]>(`${SB_TABLE}?select=${sel}&${range}&order=ts.asc&limit=${SB_READ_LIMIT}`, {})) ??
      [];

    // 最近事件：按时间倒序取最新 300 条（与允许聚合的量级无关，单独一次请求）
    const recentRows =
      (await sbRest<SbRow[]>(`${SB_TABLE}?select=${sel}&${range}&order=ts.desc&limit=300`, {})) ?? [];

    // 新访客：借 cx_session_first_day 视图（首次出现的日期 = 该 sid 的最早 day）
    const firstSeen =
      (await sbRest<{ sid: string; first_day: string }[]>(
        `cx_session_first_day?select=sid,first_day&first_day=gte.${from}&first_day=lte.${to}&limit=100000`,
        {},
      ).catch(() => [])) ?? [];
    const nvMap: Record<string, number> = {};
    for (const r of firstSeen || []) nvMap[r.first_day] = (nvMap[r.first_day] ?? 0) + 1;

    const byDay = new Map<string, AggBucket>();
    for (const k of keys) byDay.set(k, { counts: {}, dims: {}, uv: 0, nv: 0, uvSet: new Set() });
    const union = new Set<string>();
    for (const r of rows) {
      const b = byDay.get(r.day);
      if (!b) continue;
      b.counts[r.event] = (b.counts[r.event] ?? 0) + 1;
      if (r.sid) {
        b.uvSet.add(r.sid);
        union.add(r.sid);
      }
      for (const [k, v] of dimValues(rowToEvent(r))) {
        b.dims[k] = b.dims[k] ?? {};
        b.dims[k]![v] = (b.dims[k]![v] ?? 0) + 1;
      }
    }

    const out: DayResult[] = keys.map((d) => {
      const b = byDay.get(d)!;
      return { date: d, counts: b.counts, dims: b.dims, uv: b.uvSet.size, nv: nvMap[d] ?? 0 };
    });

    return {
      driver: 'supabase',
      from,
      to,
      days: out,
      recent: recentRows.map(rowToEvent),
      intervalUv: union.size,
      truncated: rows.length >= SB_READ_LIMIT,
    };
  }

  if (driver === 'kv') {
    const cmds: unknown[][] = [];
    for (const d of keys) {
      cmds.push(['HGETALL', `cx:d:${d}`]);
      cmds.push(['PFCOUNT', `cx:d:${d}:uv`]);
      for (const dim of READ_DIMS) cmds.push(['HGETALL', `cx:d:${d}:dim:${dim}`]);
    }
    cmds.push(['LRANGE', 'cx:ev', 0, 299]);
    const uvKeys = keys.map((d) => `cx:d:${d}:uv`);
    cmds.push(['PFCOUNT', ...uvKeys]);

    const res = await kvPipeline(cmds);
    const stride = 2 + READ_DIMS.length;
    const out: DayResult[] = [];
    for (let i = 0; i < keys.length; i += 1) {
      const base = i * stride;
      const counts = (res[base]?.result ?? {}) as Record<string, number | string>;
      const uv = Number(res[base + 1]?.result ?? 0) || 0;
      const dims: Partial<Record<DimKey, Record<string, number>>> = {};
      READ_DIMS.forEach((dim, j) => {
        const raw = (res[base + 2 + j]?.result ?? {}) as Record<string, number | string>;
        if (raw && Object.keys(raw).length) dims[dim] = raw as Record<string, number>;
      });
      const nv = Number(counts.__new ?? 0) || 0;
      delete counts.__new;
      out.push({ date: keys[i], counts: counts as Record<string, number>, dims, uv, nv });
    }
    const recentRaw = (res[res.length - 2]?.result ?? []) as string[];
    const intervalUv = Number(res[res.length - 1]?.result ?? 0) || 0;
    const recent: StoredEvent[] = [];
    for (const item of recentRaw) {
      try {
        recent.push(JSON.parse(item) as StoredEvent);
      } catch {
        /* 跳过损坏记录 */
      }
    }
    return { driver, from: keys[0], to: keys[keys.length - 1], days: out, recent, intervalUv };
  }

  // file
  const data = await readFile();
  const out: DayResult[] = keys.map((d) => {
    const b = data.days[d];
    if (!b) return { date: d, counts: {}, dims: {}, uv: 0, nv: 0 };
    const { uvSet: _ignored, ...rest } = b as DayBucket & { uvSet?: Record<string, 1> };
    return { date: d, ...rest };
  });
  const union = new Set<string>();
  for (const d of keys) {
    const s = (data.days[d] as DayBucket & { uvSet?: Record<string, 1> })?.uvSet;
    if (s) for (const id of Object.keys(s)) union.add(id);
  }
  return {
    driver: 'file',
    from: keys[0],
    to: keys[keys.length - 1],
    days: out,
    recent: data.events.slice(0, 300),
    intervalUv: union.size,
  };
}

/** 清空本地文件驱动的测试数据（仅 dev 用） */
export async function resetFileData(): Promise<void> {
  if (currentDriver() !== 'file') throw new Error('仅本地文件驱动支持后台清空');
  await writeFile({ events: [], days: {}, uvAll: {} });
}
