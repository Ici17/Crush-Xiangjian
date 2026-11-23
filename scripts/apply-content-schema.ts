/**
 * 把 scripts/content-schema.sql 应用到 Supabase，并自检列是否落地。
 *
 * 用法：
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx SUPABASE_PROJECT_REF=<ref> npx tsx scripts/apply-content-schema.ts --check
 *   SUPABASE_ACCESS_TOKEN=sbp_xxx SUPABASE_PROJECT_REF=<ref> npx tsx scripts/apply-content-schema.ts
 *
 * 或直连：
 *   DATABASE_URL=postgres://... npx tsx scripts/apply-content-schema.ts
 *
 * ⚠️ 只新建 cx_content_config，不碰 cx_events（埋点表口径不能动）。
 */

import fs from "node:fs";
import path from "node:path";

const SQL_PATH = path.join(process.cwd(), "scripts", "content-schema.sql");
const CHECK_ONLY = process.argv.includes("--check");

type Runner = { label: string; query: (sql: string) => Promise<unknown> };

function management(): Runner | null {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!token || !ref) return null;
  return {
    label: `Management API（${ref}）`,
    query: async (sql) => {
      const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query: sql }),
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 300)}`);
      try { return JSON.parse(text); } catch { return text; }
    },
  };
}

async function pgRunner(): Promise<Runner | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  try {
    const pg = await import("pg");
    const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
    await client.connect();
    return { label: "Postgres 直连", query: async (sql) => (await client.query(sql)).rows };
  } catch {
    return null;
  }
}

async function main() {
  const runner = management() ?? (await pgRunner());
  if (!runner) {
    console.error("缺少凭据：请设置 SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF，或 DATABASE_URL");
    process.exit(2);
  }
  console.log("驱动:", runner.label);

  if (!CHECK_ONLY) {
    const sql = fs.readFileSync(SQL_PATH, "utf-8");
    await runner.query(sql);
    console.log("DDL 已执行（幂等）");
  }

  const rows = (await runner.query(`
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'public' and table_name = 'cx_content_config'
    order by ordinal_position
  `)) as { column_name: string; data_type: string }[];
  if (!Array.isArray(rows) || rows.length === 0) {
    console.error("自检失败：cx_content_config 不存在或没有列");
    process.exit(1);
  }
  console.log("列:", rows.map((r) => r.column_name).join(", "));
  console.log("✅ cx_content_config 就绪");
}

main().catch((e) => { console.error("失败:", e); process.exit(1); });
