// ============================================================
// apply-supabase-schema.ts —— 一条命令把 scripts/supabase-schema.sql 应用上去，并自检
//
// 为什么要有它：原来这件事是「打开 Supabase 控制台 → SQL Editor → 整段粘贴 → Run」，
// 每加一批增量就得重来一次，而且**跑完没人验证**（列到底加上了没有）。
// 这里把它变成可重复执行 + 自动自检。
//
// 凭据（二选一，从环境变量读，不要写进代码）：
//   A. Supabase Management API（推荐，零依赖）
//        SUPABASE_ACCESS_TOKEN=sbp_xxx   # Dashboard → Account → Access Tokens
//        SUPABASE_PROJECT_REF=abcdefgh   # 项目 URL 里的那段子域名
//   B. 直连数据库（需要本机有 pg 依赖）
//        DATABASE_URL=postgres://postgres:PASSWORD@db.<ref>.supabase.co:5432/postgres
//
// 用法：
//   npx tsx scripts/apply-supabase-schema.ts --check   只读：看还缺什么（不写）
//   npx tsx scripts/apply-supabase-schema.ts           执行（幂等，可重复跑）
//   npx tsx scripts/apply-supabase-schema.ts --with-anon-policy   同时开放 anon 读写（默认跳过）
//
// ⚠️ 默认**跳过** anon 策略：schema.sql 里那两段 `create policy ... to anon` 会把
//    「任何持有 anon key 的人」放开读写埋点表。线上用的是 service_role（服务端写入），
//    不需要它。需要公开读的场景（比如做个公开看板）再加 --with-anon-policy。
// ============================================================

import "./_env";
import * as fs from "node:fs";
import * as path from "node:path";

const SQL_PATH = path.join(process.cwd(), "scripts", "supabase-schema.sql");

/** 把 SQL 文件拆成可逐条执行的语句：去注释、按分号切、保留非空 */
function splitStatements(sql: string): string[] {
  const noLineComments = sql
    .split("\n")
    .map((l) => (l.trim().startsWith("--") ? "" : l))
    .join("\n");
  return noLineComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function wantAnonPolicy(stmts: string[], withAnon: boolean): { keep: string[]; skipped: string[] } {
  const keep: string[] = [];
  const skipped: string[] = [];
  for (const s of stmts) {
    const isAnonPolicy = /create policy\s+\w+\s+on\s+public\.cx_events\s+for\s+(insert|select)\s+to\s+anon/i.test(s);
    if (isAnonPolicy && !withAnon) skipped.push(s.split("\n")[0]);
    else keep.push(s);
  }
  return { keep, skipped };
}

interface Runner {
  label: string;
  query: (sql: string) => Promise<unknown>;
}

function makeManagementRunner(): Runner | null {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!token || !ref) return null;
  return {
    label: `Management API（项目 ${ref}）`,
    query: async (sql: string) => {
      const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    },
  };
}

async function makePgRunner(): Promise<Runner | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  // 动态 import：没装 pg 时不影响其他路径
  try {
    const pg = await import("pg");
    const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await client.connect();
    return {
      label: "直连 Postgres（pg）",
      query: async (sql: string) => {
        const r = await client.query(sql);
        return r.rows;
      },
    };
  } catch (e) {
    console.error(`  ⚠️ DATABASE_URL 已配置，但 pg 驱动不可用：${(e as Error).message}`);
    return null;
  }
}

const CHECKS = [
  {
    name: "表 cx_events",
    sql: `select count(*)::int as n from information_schema.tables where table_schema='public' and table_name='cx_events'`,
    expect: (rows: unknown) => Number((rows as Array<{ n: number }>)[0]?.n ?? 0) > 0,
    detail: "表不存在 → 整段 schema 从未执行过",
  },
  {
    name: "列 sess（会话）",
    sql: `select count(*)::int as n from information_schema.columns where table_name='cx_events' and column_name='sess'`,
    expect: (rows: unknown) => Number((rows as Array<{ n: number }>)[0]?.n ?? 0) > 0,
    detail: "缺这一列 → 会话数 / 第 2 批漏斗维度缺失（写入会降级，不丢数）",
  },
  {
    name: "列 eid（幂等）",
    sql: `select count(*)::int as n from information_schema.columns where table_name='cx_events' and column_name='eid'`,
    expect: (rows: unknown) => Number((rows as Array<{ n: number }>)[0]?.n ?? 0) > 0,
    detail: "缺这一列 → 事件幂等失效（重复上报会算两遍）",
  },
  {
    name: "唯一索引 cx_events_eid_uniq",
    sql: `select count(*)::int as n from pg_indexes where tablename='cx_events' and indexname='cx_events_eid_uniq'`,
    expect: (rows: unknown) => Number((rows as Array<{ n: number }>)[0]?.n ?? 0) > 0,
    detail: "缺索引 → 幂等只靠代码，DB 层不兜底",
  },
  {
    name: "索引 cx_events_sess_idx",
    sql: `select count(*)::int as n from pg_indexes where tablename='cx_events' and indexname='cx_events_sess_idx'`,
    expect: (rows: unknown) => Number((rows as Array<{ n: number }>)[0]?.n ?? 0) > 0,
    detail: "缺索引 → 会话聚合查询会慢（数据量大了才明显）",
  },
];

async function runChecks(runner: Runner): Promise<boolean> {
  console.log("\n══════ 自检（当前库结构）══════");
  let allOk = true;
  for (const c of CHECKS) {
    try {
      const rows = await runner.query(c.sql);
      const good = c.expect(rows);
      if (good) console.log(`  ✅ ${c.name}`);
      else {
        console.log(`  ❌ ${c.name} —— ${c.detail}`);
        allOk = false;
      }
    } catch (e) {
      console.log(`  ❌ ${c.name} 查询失败：${(e as Error).message}`);
      allOk = false;
    }
  }
  return allOk;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const checkOnly = args.includes("--check");
  const withAnon = args.includes("--with-anon-policy");

  if (!fs.existsSync(SQL_PATH)) {
    console.error(`找不到 ${SQL_PATH}`);
    process.exit(1);
  }

  const runner = makeManagementRunner() ?? (await makePgRunner());
  if (!runner) {
    console.error("══════ 无法连接 Supabase ══════\n");
    console.error("  缺少凭据。二选一：");
    console.error("    A) SUPABASE_ACCESS_TOKEN=sbp_xxx SUPABASE_PROJECT_REF=xxxx");
    console.error("       （Dashboard → Account → Access Tokens；ref 是项目 URL 里的子域名）");
    console.error("    B) DATABASE_URL=postgres://postgres:PWD@db.<ref>.supabase.co:5432/postgres");
    console.error("\n  不提供凭据的替代做法：控制台 → SQL Editor → 整段粘贴 scripts/supabase-schema.sql → Run");
    process.exit(2);
  }

  console.log(`══════ 连接方式：${runner.label} ══════`);

  if (checkOnly) {
    const ok = await runChecks(runner);
    console.log(ok ? "\n  ✅ 结构完整，无需执行 DDL" : "\n  ⚠️ 有待补的结构 → 去掉 --check 再跑一次即可（脚本幂等）");
    process.exit(ok ? 0 : 1);
  }

  const sql = fs.readFileSync(SQL_PATH, "utf8");
  const { keep, skipped } = wantAnonPolicy(splitStatements(sql), withAnon);
  console.log(`\n══════ 执行 DDL（${keep.length} 条语句）══════`);
  if (skipped.length) {
    console.log(`  跳过 ${skipped.length} 条 anon 策略（默认只给 service_role 用，需要公开读加 --with-anon-policy）：`);
    for (const s of skipped) console.log(`    · ${s}`);
  }

  for (const [i, stmt] of keep.entries()) {
    const head = stmt.replace(/\s+/g, " ").slice(0, 70);
    try {
      await runner.query(stmt);
      console.log(`  ✅ ${i + 1}/${keep.length} ${head}…`);
    } catch (e) {
      console.error(`  ❌ ${i + 1}/${keep.length} ${head}…\n     ${(e as Error).message}`);
      process.exit(1);
    }
  }

  const ok = await runChecks(runner);
  console.log(ok ? "\n  ✅ 全部就绪" : "\n  ⚠️ 执行完成但自检未全绿，请看上面 ❌ 项");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
