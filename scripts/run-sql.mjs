// 通过 Supabase Management API 执行 SQL 脚本（一次性运维用）
import fs from 'node:fs';
import path from 'node:path';

const SBT = process.env.SBT;
const REF = process.env.REF;
const sqlPath = process.argv[2];

if (!SBT || !REF || !sqlPath) {
  console.error('usage: SBT=... REF=... node run-sql.mjs <file.sql>');
  process.exit(1);
}

const sql = fs.readFileSync(path.resolve(sqlPath), 'utf8');

async function main() {
  const endpoints = [
    `https://api.supabase.com/v1/projects/${REF}/database/query`,
    `https://api.supabase.com/v1/projects/${REF}/sql`,
  ];
  for (const url of endpoints) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SBT}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    });
    const text = await res.text();
    console.log(`\n--- ${url}\nHTTP ${res.status}\n${text.slice(0, 1200)}`);
    if (res.ok) {
      console.log('\nOK: SQL executed via ' + url);
      return;
    }
  }
  process.exit(1);
}

main().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(1);
});
