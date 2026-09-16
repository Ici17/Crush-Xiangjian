/**
 * 埋点存储层（仅服务端使用）。
 *
 * 四档驱动，自动探测，无需改代码：
 *  1. supabase —— 配了 SUPABASE_URL + key → 写入 Postgres（线上真实持久化，可 SQL 查询）
 *  2. kv       —— 配了 Vercel KV / Upstash Redis 环境变量 → 写入 Redis
 *  3. file     —— 本地开发兜底，写入 .data/analytics.json（Vercel 上不持久，仅 dev 用）
 *  4. log      —— 都没有时，仅打函数日志（保持旧行为，绝不报错影响主流程）
 *
 * 合规：不读请求 IP、不存任何 PII；只存匿名访客 / 会话 ID（前端随机生成，无 Cookie、无指纹）。
 *
 * 第 2 批（2026-09-16）增量：
 *  - 事件拆分为「访客 vid」与「会话 sid」两层；DB 列 `sid` 仍承载访客（历史语义不变），
 *    新列 `sess` 承载会话；新列 `eid` 承载幂等 id。
 *  - KV 每日命令布局收敛为单一具名 layout，读写共享、索引全部派生，杜绝裸数字下标错位。
 *  - Supabase 写入对「列不存在」（DDL 未执行）自动降级重试，保证 code-first 上线不丢数。
 *  - KV / Supabase / file 三档均对 `session_start` 按 sid 去重（多标签页偶发重复判定新会话）。
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
  /** 访客（长期，映射到 DB 列 sid） */
  vid: string;
  /** 会话（30 分钟滚动窗口，映射到 DB 列 sess） */
  sid: string;
  /** 事件幂等 id（可空，兼容旧客户端） */
  eid?: string;
  path: string;
  ts: number;
  receivedAt: number;
};

export type DayBucket = {
  counts: Record<string, number>;
  dims: Partial<Record<DimKey, Record<string, number>>>;
  uv: number;
  nv: number;
  /** 当日去重会话数（第 2 批新增，可选，不破坏既有结构） */
  sessions?: number;
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
  /** 区间内去重后的会话数（第 2 批新增，可选） */
  intervalSessions?: number;
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

type SbInsertResult = { ok: true } | { ok: false; status: number; body: string };

/** 插入一行，返回结构化结果（不抛错），便于调用方按状态码分支。 */
async function sbInsert(row: Record<string, unknown>): Promise<SbInsertResult> {
  const res = await fetch(`${SB_URL.replace(/\/$/, '')}/rest/v1/${SB_TABLE}`, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'content-type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
    cache: 'no-store',
  });
  if (res.ok) return { ok: true };
  const body = await res.text().catch(() => '');
  return { ok: false, status: res.status, body: body.slice(0, 300) };
}

/**
 * 判断 PostgREST 错误是否为「列不存在」（DDL 未执行）。
 * 线上表可能先于 DDL 部署，此时写 `sess` / `eid` 会整条失败 → 埋点全丢。
 */
function isMissingColumn(r: { status: number; body: string }): boolean {
  if (r.status !== 400 && r.status !== 404 && r.status !== 409) return false;
  if (r.status === 409) return false; // 409 是 eid 唯一冲突，按成功处理
  const b = r.body || '';
  return (
    b.includes('PGRST204') ||
    b.includes('42703') ||
    /could not find the ['"]?(sess|eid)['"]? column/i.test(b) ||
    /column\s+["']?(sess|eid)["']?\s+.*does not exist/i.test(b) ||
    (b.includes('schema cache') && (b.includes('sess') || b.includes('eid')))
  );
}

/** DDL 未执行的降级提示只打一次，避免刷屏 */
let missingColumnWarned = false;

type SbRow = {
  ts: string;
  day: string;
  event: string;
  path: string | null;
  sid: string | null;
  sess?: string | null;
  eid?: string | null;
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
// KV 每日命令布局 —— 读、写共享同一份定义（根治裸数字下标）
// ============================================================
//
// 历史 bug 根因：写路径用 `res[2].result === 1` 判断新访客（指向 PFADD cx:uv:all），
// 读路径用 `stride = 2 + READ_DIMS.length` 解包 —— 两处各自硬编码。一旦在每日命令里
// 插入一条（如新增 PFADD cx:d:{day}:sess），两处都会静默错位：新访客统计错乱、
// 维度整段错位，且不报错。现在统一为：**构造与解包都遍历 KV_DAY_SLOTS，索引具名派生**。
//
// 每日槽位顺序（读、写必须一致）：
//   counts  → HINCRBY  cx:d:{day}            (事件计数哈希)
//   uv      → PFADD/COUNT cx:d:{day}:uv      (当日去重访客)
//   sess    → PFADD/COUNT cx:d:{day}:sess    (当日去重会话)
//   sstart  → SADD/SCARD  cx:d:{day}:sstart   (当日 session_start 的访客集合，按 sid 去重)
//   dim:*   → HINCRBY cx:d:{day}:dim:{key}   (各维度计数)
const KV_DAY_SLOTS = ['counts', 'uv', 'sess', 'sstart', ...DIM_KEYS.map((k) => `dim:${k}`)] as const;

/** 具名布局：所有读写索引一律从这里取，禁止裸数字下标 */
const KV_DAY_LAYOUT = {
  counts: KV_DAY_SLOTS.indexOf('counts'),
  uv: KV_DAY_SLOTS.indexOf('uv'),
  sess: KV_DAY_SLOTS.indexOf('sess'),
  sstart: KV_DAY_SLOTS.indexOf('sstart'),
  dims: Object.fromEntries(
    DIM_KEYS.map((k) => [k, KV_DAY_SLOTS.indexOf(`dim:${k}` as (typeof KV_DAY_SLOTS)[number])]),
  ) as Record<DimKey, number>,
};

/**
 * 每日命令数（= 每日槽位数）。
 * 读端 stride 直接用它；scripts/audit-analytics.ts 亦断言
 * `KV_DAY_COMMANDS === DIM_KEYS.length + 4`，防止有人把 layout 改回硬编码。
 */
export const KV_DAY_COMMANDS = KV_DAY_SLOTS.length;

/** uvAll 命令在「写」管道中的索引：紧随每日槽位之后（具名派生，勿写裸数字）。 */
const KV_UV_ALL_INDEX = KV_DAY_COMMANDS;

/** 恒等占位命令：结果为空对象，读端 `Object.keys(raw).length === 0` 自动跳过 */
const KV_NOOP: unknown[] = ['HGETALL', 'cx:d:__noop__'];

/** 按 KV_DAY_SLOTS 顺序构造「当日」写命令，长度恒等于 KV_DAY_COMMANDS。 */
function buildDayWriteCommands(
  day: string,
  ev: StoredEvent,
  uvMember: string,
  sessMember: string,
): unknown[][] {
  const dims = new Map<string, string>(dimValues(ev));
  return KV_DAY_SLOTS.map((slot): unknown[] => {
    if (slot === 'counts') return ['HINCRBY', `cx:d:${day}`, ev.event, 1];
    if (slot === 'uv') return ['PFADD', `cx:d:${day}:uv`, uvMember];
    if (slot === 'sess') return ['PFADD', `cx:d:${day}:sess`, sessMember];
    if (slot === 'sstart') {
      return ev.event === 'session_start' && ev.sid
        ? ['SADD', `cx:d:${day}:sstart`, ev.sid]
        : KV_NOOP;
    }
    const key = slot.slice('dim:'.length);
    const v = dims.get(key);
    return v === undefined ? KV_NOOP : ['HINCRBY', `cx:d:${day}:dim:${key}`, v, 1];
  });
}

// ============================================================
// 文件驱动（本地 dev）
// ============================================================

const DATA_DIR = path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'analytics.json');

type FileBucket = DayBucket & {
  uvSet?: Record<string, 1>;
  sessionsSet?: Record<string, 1>;
  sstartSet?: Record<string, 1>;
};

type FileShape = {
  events: StoredEvent[];
  days: Record<string, FileBucket>;
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

function emptyBucket(): FileBucket {
  return { counts: {}, dims: {}, uv: 0, nv: 0, uvSet: {}, sessionsSet: {}, sstartSet: {} };
}

// ============================================================
// 写入
// ============================================================

function dimValues(ev: StoredEvent): Array<[DimKey, string]> {
  const out: Array<[DimKey, string]> = [];
  // 去重：`path` 既是顶层字段又是 DIM_KEYS 成员，不去重会被计两次，把该维度凭空翻倍
  const seen = new Set<DimKey>();
  if (ev.path) {
    out.push(['path', ev.path]);
    seen.add('path');
  }
  for (const key of DIM_KEYS) {
    if (seen.has(key)) continue;
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
    const row: Record<string, unknown> = {
      day: shanghaiDateKey(ev.ts),
      ts: new Date(ev.ts).toISOString(),
      event: ev.event,
      path: ev.path || null,
      // DB 列 sid 语义保持「访客」（历史口径不变），会话写入新列 sess
      sid: ev.vid || null,
      sess: ev.sid || null,
      eid: ev.eid || null,
      props: (ev.props ?? {}) as Record<string, PropValueLike>,
    };
    try {
      let r = await sbInsert(row);
      // 列缺失降级：线上表可能尚未执行 DDL（sess / eid 未建）→ 整条写入失败 → 埋点全丢。
      // 自动去掉新列重试一次，保证 code-first 部署不丢数；重试仍失败才降级到 log。
      if (!r.ok && isMissingColumn(r)) {
        if (!missingColumnWarned) {
          missingColumnWarned = true;
          console.warn(
            '[analytics] cx_events 缺少 sess / eid 列，已降级为旧结构写入；' +
              '请执行 scripts/supabase-schema.sql 的第 2 批 DDL 以启用会话分析',
          );
        }
        const { sess: _sess, eid: _eid, ...legacyRow } = row;
        r = await sbInsert(legacyRow);
      }
      if (r.ok) return;
      // 幂等冲突（eid 唯一索引）：该事件已入库，视为成功
      if (r.status === 409) return;
      throw new Error(`supabase ${r.status} ${r.body}`);
    } catch (e) {
      console.error('[analytics] supabase write failed, fallback log', e);
    }
    console.log('[event]', JSON.stringify(ev));
    return;
  }

  if (driver === 'kv') {
    try {
      const day = shanghaiDateKey(ev.ts);
      const uvMember = ev.vid || `anon_${Math.random().toString(36).slice(2)}`;
      const sessMember = ev.sid || uvMember;

      // 幂等：drain 前先占位，返回 null ＝ 已存在 → 跳过（fail-open：不可达时放行）
      if (ev.eid) {
        try {
          const setRes = await kvCall(['SET', `cx:eid:${ev.eid}`, '1', 'NX', 'EX', '86400']);
          if (setRes === null) return;
        } catch {
          /* 去重存储不可达 → 放行，宁可偶发重复也不丢数 */
        }
      }

      const cmds = buildDayWriteCommands(day, ev, uvMember, sessMember);
      cmds.push(['PFADD', 'cx:uv:all', uvMember]); // 索引 === KV_UV_ALL_INDEX
      cmds.push(['LPUSH', 'cx:ev', JSON.stringify(ev)]);
      cmds.push(['LTRIM', 'cx:ev', 0, 4999]);

      const res = await kvPipeline(cmds);
      // PFADD cx:uv:all 返回 1 = 该访客首次出现 → 计为新访客（索引具名派生，勿写裸数字）
      if (res?.[KV_UV_ALL_INDEX]?.result === 1 && ev.vid) {
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
      const bucket = data.days[day] ?? emptyBucket();
      bucket.counts[ev.event] = (bucket.counts[ev.event] ?? 0) + 1;

      // 访客去重（UV / 新访客口径）—— 按 vid
      bucket.uvSet = bucket.uvSet ?? {};
      if (ev.vid && !bucket.uvSet[ev.vid]) {
        bucket.uvSet[ev.vid] = 1;
        bucket.uv += 1;
        data.uvAll = data.uvAll ?? {};
        if (!data.uvAll[ev.vid]) {
          data.uvAll[ev.vid] = 1;
          bucket.nv += 1;
        }
      }
      // 会话去重 —— 按 sid
      bucket.sessionsSet = bucket.sessionsSet ?? {};
      if (ev.sid && !bucket.sessionsSet[ev.sid]) bucket.sessionsSet[ev.sid] = 1;
      // session_start 按 sid 去重（多标签页偶发重复判定新会话）
      bucket.sstartSet = bucket.sstartSet ?? {};
      if (ev.event === 'session_start' && ev.sid && !bucket.sstartSet[ev.sid]) {
        bucket.sstartSet[ev.sid] = 1;
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

/** 读取时展开的维度 —— 直接复用 DIM_KEYS，杜绝第二份副本漏同步
 *
 * 2026-09-16 修复：此前这里是一份手工维护的常量，比 DIM_KEYS 少了 `format`，
 * 导致 KV 驱动的看板读不到 format 维度、Supabase 驱动却读得到 ——
 * 两种驱动的同一份数据口径不一致，且不会有任何报错。
 */
const READ_DIMS: readonly DimKey[] = DIM_KEYS;

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
    vid: r.sid ?? '',
    sid: r.sess ?? '',
    eid: r.eid ?? undefined,
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
  sessionsSet: Set<string>;
};

export async function readRange(days = 14): Promise<RangeResult> {
  const keys = dateKeys(days);
  const driver = currentDriver();

  if (driver === 'supabase') {
    const from = keys[0];
    const to = keys[keys.length - 1];
    const sel = 'ts,day,event,path,sid,sess,eid,props';
    const range = `day=gte.${from}&day=lte.${to}`;

    const rows =
      (await sbRest<SbRow[]>(`${SB_TABLE}?select=${sel}&${range}&order=ts.asc&limit=${SB_READ_LIMIT}`, {})) ??
      [];

    // 最近事件：按时间倒序取最新 300 条（与允许聚合的量级无关，单独一次请求）
    const recentRows =
      (await sbRest<SbRow[]>(`${SB_TABLE}?select=${sel}&${range}&order=ts.desc&limit=300`, {})) ?? [];

    // 新访客：借 cx_session_first_day 视图（首次出现的日期 = 该访客 sid 的最早 day）
    const firstSeen =
      (await sbRest<{ sid: string; first_day: string }[]>(
        `cx_session_first_day?select=sid,first_day&first_day=gte.${from}&first_day=lte.${to}&limit=100000`,
        {},
      ).catch(() => [])) ?? [];
    const nvMap: Record<string, number> = {};
    for (const r of firstSeen || []) nvMap[r.first_day] = (nvMap[r.first_day] ?? 0) + 1;

    const byDay = new Map<string, AggBucket>();
    for (const k of keys) {
      byDay.set(k, { counts: {}, dims: {}, uv: 0, nv: 0, uvSet: new Set(), sessionsSet: new Set() });
    }
    const union = new Set<string>();
    const sessionsUnion = new Set<string>();
    // session_start 按访客 sid 去重（多标签页偶发重复判定新会话）
    const sessionStartSids = new Map<string, Set<string>>();

    for (const r of rows) {
      const b = byDay.get(r.day);
      if (!b) continue;
      b.counts[r.event] = (b.counts[r.event] ?? 0) + 1;
      if (r.event === 'session_start' && r.sid) {
        let s = sessionStartSids.get(r.day);
        if (!s) {
          s = new Set();
          sessionStartSids.set(r.day, s);
        }
        s.add(r.sid);
      }
      // UV / 新访客口径：仍按访客列 sid 计算（历史口径不变）
      if (r.sid) {
        b.uvSet.add(r.sid);
        union.add(r.sid);
      }
      // 会话数：按新列 sess 去重
      if (r.sess) {
        b.sessionsSet.add(r.sess);
        sessionsUnion.add(r.sess);
      }
      for (const [k, v] of dimValues(rowToEvent(r))) {
        b.dims[k] = b.dims[k] ?? {};
        b.dims[k]![v] = (b.dims[k]![v] ?? 0) + 1;
      }
    }
    for (const [day, s] of sessionStartSids) {
      const b = byDay.get(day);
      if (b) b.counts.session_start = s.size;
    }

    const out: DayResult[] = keys.map((d) => {
      const b = byDay.get(d)!;
      return {
        date: d,
        counts: b.counts,
        dims: b.dims,
        uv: b.uvSet.size,
        nv: nvMap[d] ?? 0,
        sessions: b.sessionsSet.size,
      };
    });

    return {
      driver: 'supabase',
      from,
      to,
      days: out,
      recent: recentRows.map(rowToEvent),
      intervalUv: union.size,
      intervalSessions: sessionsUnion.size,
      truncated: rows.length >= SB_READ_LIMIT,
    };
  }

  if (driver === 'kv') {
    const cmds: unknown[][] = [];
    for (const d of keys) {
      // 读命令与写命令严格共用 KV_DAY_SLOTS，保持 stride 对齐
      for (const slot of KV_DAY_SLOTS) {
        if (slot === 'counts') cmds.push(['HGETALL', `cx:d:${d}`]);
        else if (slot === 'uv') cmds.push(['PFCOUNT', `cx:d:${d}:uv`]);
        else if (slot === 'sess') cmds.push(['PFCOUNT', `cx:d:${d}:sess`]);
        else if (slot === 'sstart') cmds.push(['SCARD', `cx:d:${d}:sstart`]);
        else cmds.push(['HGETALL', `cx:d:${d}:dim:${slot.slice('dim:'.length)}`]);
      }
    }
    cmds.push(['LRANGE', 'cx:ev', 0, 299]);
    const uvKeys = keys.map((d) => `cx:d:${d}:uv`);
    cmds.push(['PFCOUNT', ...uvKeys]);

    const res = await kvPipeline(cmds);
    const stride = KV_DAY_COMMANDS;
    const out: DayResult[] = [];
    for (let i = 0; i < keys.length; i += 1) {
      const base = i * stride;
      const counts = (res[base + KV_DAY_LAYOUT.counts]?.result ?? {}) as Record<string, number | string>;
      const uv = Number(res[base + KV_DAY_LAYOUT.uv]?.result ?? 0) || 0;
      const sessions = Number(res[base + KV_DAY_LAYOUT.sess]?.result ?? 0) || 0;
      const sstart = Number(res[base + KV_DAY_LAYOUT.sstart]?.result ?? 0) || 0;
      const dims: Partial<Record<DimKey, Record<string, number>>> = {};
      for (const dim of READ_DIMS) {
        const raw = (res[base + KV_DAY_LAYOUT.dims[dim]]?.result ?? {}) as Record<string, number | string>;
        if (raw && Object.keys(raw).length) dims[dim] = raw as Record<string, number>;
      }
      const nv = Number(counts.__new ?? 0) || 0;
      delete counts.__new;
      // session_start 按 sid 去重：集合基数即「不同会话数」，覆盖 HINCRBY 原始计数
      if (sstart > 0) counts.session_start = sstart;
      out.push({ date: keys[i], counts: counts as Record<string, number>, dims, uv, nv, sessions });
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
    if (!b) return { date: d, counts: {}, dims: {}, uv: 0, nv: 0, sessions: 0 };
    const sessions = b.sessionsSet ? Object.keys(b.sessionsSet).length : 0;
    const counts = { ...b.counts };
    // session_start 按 sid 去重
    if (b.sstartSet && Object.keys(b.sstartSet).length) {
      counts.session_start = Object.keys(b.sstartSet).length;
    }
    return { date: d, counts, dims: b.dims, uv: b.uv, nv: b.nv, sessions };
  });
  const union = new Set<string>();
  const sessionsUnion = new Set<string>();
  for (const d of keys) {
    const b = data.days[d];
    if (b?.uvSet) for (const id of Object.keys(b.uvSet)) union.add(id);
    if (b?.sessionsSet) for (const id of Object.keys(b.sessionsSet)) sessionsUnion.add(id);
  }
  return {
    driver: 'file',
    from: keys[0],
    to: keys[keys.length - 1],
    days: out,
    recent: data.events.slice(0, 300),
    intervalUv: union.size,
    intervalSessions: sessionsUnion.size,
  };
}

/** 清空本地文件驱动的测试数据（仅 dev 用） */
export async function resetFileData(): Promise<void> {
  if (currentDriver() !== 'file') throw new Error('仅本地文件驱动支持后台清空');
  await writeFile({ events: [], days: {}, uvAll: {} });
}
