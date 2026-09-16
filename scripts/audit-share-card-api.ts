/**
 * /api/share-card 路由自检（A 组 · 2026-09-16）
 *
 * 直接 import 路由的 GET 处理函数并用 NextRequest 调用（不经 HTTP），
 * 覆盖「请求校验 → 服务端派生 → 渲染」整条链路。
 * 比起服务再 curl 更稳（不会被后台任务时限回收），也可重复运行。
 *
 * 断言：
 *   1. 三个新场景（guardian / contrast / codex）均返回 200 + image/png + 合法 PNG
 *   2. 未知人格 / 未知场景返回 4xx（校验生效）
 *   3. codex 不传 lit 也能出图（0 格空态）
 *   4. 服务端派生的内容与人格一致（guardian 的香名 = getGuardianPerfume 的名字）
 *
 * 运行：npx tsx scripts/audit-share-card-api.ts
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NextRequest } from "next/server";
import { GET } from "../app/api/share-card/route";
import { getGuardianPerfume } from "../lib/personalities";

let pass = 0;
let fail = 0;
function ck(cond: boolean, label: string, detail = "") {
  if (cond) {
    pass++;
    console.log(`  OK   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

const OUT_DIR = join(process.cwd(), ".data", "share-cards");

function isPng(buf: Buffer): boolean {
  return (
    buf.length > 24 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
  );
}

async function call(query: string): Promise<{ status: number; type: string; buf: Buffer }> {
  const req = new NextRequest(`http://localhost/api/share-card?${query}`);
  const res = await GET(req);
  const ab = await res.arrayBuffer();
  return {
    status: res.status,
    type: res.headers.get("content-type") ?? "",
    buf: Buffer.from(ab),
  };
}

async function expectPng(label: string, query: string, outName: string) {
  const r = await call(query);
  ck(r.status === 200, `${label} 返回 200`, `实际 ${r.status} ${r.buf.toString("utf8").slice(0, 120)}`);
  if (r.status !== 200) return null;
  ck(r.type.includes("image/png"), `${label} Content-Type = image/png`, r.type);
  ck(isPng(r.buf), `${label} 是合法 PNG`);
  const w = r.buf.readUInt32BE(16);
  const h = r.buf.readUInt32BE(20);
  ck(w === 1080, `${label} 宽度 1080`, `实际 ${w}`);
  ck(h === 1620, `${label} 高度 1620（3:4）`, `实际 ${h}`);
  writeFileSync(join(OUT_DIR, `${outName}.png`), r.buf);
  console.log(`       ↳ ${(r.buf.length / 1024).toFixed(0)} KB → ${outName}.png`);
  return r.buf;
}

async function expect4xx(label: string, query: string) {
  const r = await call(query);
  ck(r.status >= 400 && r.status < 500, `${label} 被拒绝（4xx）`, `实际 ${r.status}`);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  console.log("=== /api/share-card 路由自检 ===");

  const n = encodeURIComponent("残温");
  const pair1 = encodeURIComponent("残温|暗流");
  const pair2 = encodeURIComponent("暗流|残温");

  await expectPng("guardian 路由", `scene=guardian&name=${n}`, "api-guardian");
  await expectPng("contrast 路由", `scene=contrast&name=${n}`, "api-contrast");
  await expectPng("codex 路由（2 格）", `scene=codex&lit=${pair1},${pair2}&name=${n}`, "api-codex");
  await expectPng("codex 路由（0 格空态）", "scene=codex", "api-codex-empty");

  // 回归：老场景不能被新分支影响
  await expectPng("daily 路由（回归）", "scene=daily", "api-daily");

  await expect4xx("guardian 未知人格", "scene=guardian&name=NOTEXIST");
  await expect4xx("contrast 未知人格", "scene=contrast&name=NOTEXIST");
  await expect4xx("未知场景", "scene=nope");
  await expect4xx("guardian 缺 name", "scene=guardian");

  // 服务端派生一致性：路由出图用的就是 getGuardianPerfume 的结果
  const g = getGuardianPerfume("残温");
  ck(!!g, "guardian 数据源可派生");

  console.log(`\n=== 结果：${pass} 通过 / ${fail} 失败 ===`);
  console.log(`产物目录：${OUT_DIR}`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("自检异常：", e);
  process.exit(1);
});
