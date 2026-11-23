/**
 * 内容配置读取层（L1 展示文案 / L2 算法配置）
 *
 * 零新依赖：直接走 Supabase REST，与 lib/analytics/store.ts 同一套 env。
 *
 * ⚠️ 三条硬约束：
 *  1. **读不到配置 = 零行为变化**：没有凭据 / 表还没建 / 网络失败时一律返回空对象，
 *     调用方用静态常量兜底，本地开发和 CI 完全不受影响。
 *  2. 公开 API 只返回 `scope='copy'` 且 published 的条目；算法配置（scope='config'）
 *     只在服务端读取，不通过公开接口暴露。
 *  3. 服务端短缓存（60s）：避免每个请求都打 Supabase；发布后最多 60s 生效。
 */

export type ContentScope = "copy" | "config";

export interface ContentEntry {
  key: string;
  scope: ContentScope;
  value: unknown;
  version: number;
  published: boolean;
  note?: string | null;
  updated_at?: string;
}

const SB_URL =
  process.env.SUPABASE_URL ||
  process.env.SUPABASE_REST_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";
const SB_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

const TABLE = process.env.SUPABASE_CONTENT_TABLE || "cx_content_config";
const CACHE_MS = 60_000;

type CacheEntry = { at: number; data: Record<string, ContentEntry> };
const cache = new Map<ContentScope, CacheEntry>();

function restUrl(scope: ContentScope, publishedOnly: boolean): string {
  const u = new URL(`${SB_URL.replace(/\/$/, "")}/rest/v1/${TABLE}`);
  u.searchParams.set("select", "key,scope,value,version,published,note,updated_at");
  u.searchParams.set("scope", `eq.${scope}`);
  if (publishedOnly) u.searchParams.set("published", "eq.true");
  return u.toString();
}

/** 从 Supabase 读配置；任何失败都返回空对象（不抛给调用方） */
export async function readConfig(
  scope: ContentScope,
  publishedOnly = true,
): Promise<Record<string, ContentEntry>> {
  if (!SB_URL || !SB_KEY) return {};
  const key = publishedOnly ? scope : (`${scope}:all` as ContentScope);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  try {
    const res = await fetch(restUrl(scope, publishedOnly), {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      next: { revalidate: 60 },
    });
    if (!res.ok) return {};
    const rows = (await res.json()) as ContentEntry[];
    if (!Array.isArray(rows)) return {};
    const data: Record<string, ContentEntry> = {};
    for (const r of rows) if (r?.key) data[r.key] = r;
    cache.set(key, { at: Date.now(), data });
    return data;
  } catch {
    return {};
  }
}

/** 公开只读：取已发布的文案覆盖，value 必须是字符串 */
export async function readPublishedCopy(): Promise<Record<string, string>> {
  const all = await readConfig("copy", true);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(all)) {
    if (typeof v.value === "string") out[k] = v.value;
  }
  return out;
}

/** 服务端专用：取已发布的算法配置（不经过公开 API） */
export async function readPublishedConfig(): Promise<Record<string, unknown>> {
  const all = await readConfig("config", true);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(all)) {
    if (v.value !== null && typeof v.value === "object") out[k] = v.value;
    else out[k] = v.value;
  }
  return out;
}

export function clearConfigCache(): void {
  cache.clear();
}

/** 后台写入（upsert by key）。成功返回 true；没凭据或失败返回 false。 */
export async function upsertConfig(entry: {
  key: string;
  scope: ContentScope;
  value: unknown;
  version: number;
  published: boolean;
  note?: string;
}): Promise<boolean> {
  if (!SB_URL || !SB_KEY) return false;
  try {
    const url = new URL(`${SB_URL.replace(/\/$/, "")}/rest/v1/${TABLE}`);
    url.searchParams.set("on_conflict", "key");
    const res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        apikey: SB_KEY,
        Authorization: `Bearer ${SB_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify([{ ...entry, updated_at: new Date().toISOString() }]),
      cache: "no-store",
    });
    if (!res.ok) return false;
    clearConfigCache();
    return true;
  } catch {
    return false;
  }
}

/** 凭据是否配置（不等于表已建） */
export function configStoreReady(): boolean {
  return Boolean(SB_URL && SB_KEY);
}

/** 真实探测表是否可访问：表没建时 REST 会 404，让后台如实提示「未就绪」 */
export async function probeConfigTable(): Promise<boolean> {
  if (!SB_URL || !SB_KEY) return false;
  try {
    const u = new URL(`${SB_URL.replace(/\/$/, "")}/rest/v1/${TABLE}`);
    u.searchParams.set("select", "key");
    u.searchParams.set("limit", "1");
    const res = await fetch(u.toString(), {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}
