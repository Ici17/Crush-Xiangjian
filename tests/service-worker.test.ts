/**
 * Service Worker 离线缓存的隐私契约测试。
 *
 * 2026-11-10 实测：旧版 sw.js 对所有同源 GET 无差别 cache.put，
 * 真实浏览器里 `/api/admin/session` 的响应被写进了 crushxiangjian-v1 缓存。
 * 同理 `/api/admin/overview`（含最近 100 条事件明细与匿名访客 ID）、
 * `/api/share-card?...`（含人格 / 雷达 / 邀请码）都会被持久化，
 * 且离线时 caches.match 直接返回缓存、不再校验登录态。
 *
 * 服务端返回 Cache-Control: no-store 也挡不住 Cache API 的手动 put，
 * 所以只能在 SW 侧旁路。这里锁住旁路逻辑本身，而不只是「写没写注释」。
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const src = readFileSync(path.join(process.cwd(), "public", "sw.js"), "utf8");

/** 把 sw.js 里那段旁路函数原样取出来执行，测的是真实逻辑而非字符串存在 */
function bypass(urlPath: string): boolean {
  const m = src.match(/function shouldBypassCache\(url\)\s*\{([\s\S]*?)\n\}/);
  assert.ok(m, "sw.js 必须定义 shouldBypassCache(url)");
  const fn = new Function("url", m[1]) as (u: { pathname: string }) => boolean;
  return fn({ pathname: urlPath });
}

test("所有 /api/ 路由都不进离线缓存", () => {
  for (const p of [
    "/api/admin/overview",
    "/api/admin/session",
    "/api/event",
    "/api/share-card",
    "/api/og",
  ]) {
    assert.equal(bypass(p), true, `${p} 必须旁路缓存`);
  }
});

test("后台页面也不进离线缓存", () => {
  assert.equal(bypass("/admin"), true);
  assert.equal(bypass("/admin/anything"), true);
});

test("静态页面与构建产物仍可正常缓存", () => {
  for (const p of ["/", "/result", "/question", "/_next/static/chunks/a.js", "/sw.js"]) {
    assert.equal(bypass(p), false, `${p} 不应被误旁路`);
  }
});

test("旁路判断必须在 cache.put 之前，且真的在 fetch handler 里调用", () => {
  const iBypass = src.indexOf("shouldBypassCache(url)");
  const iPut = src.indexOf("cache.put(");
  assert.ok(iBypass >= 0, "fetch handler 必须调用 shouldBypassCache(url)");
  assert.ok(iPut >= 0);
  assert.ok(iBypass < iPut, "旁路判断被挪到 cache.put 之后等于没生效");
});

test("缓存版本已升级，旧 v1 里的 API 响应会被 activate 清掉", () => {
  assert.match(src, /CACHE_NAME\s*=\s*"crushxiangjian-v2"/);
  assert.ok(!/CACHE_NAME\s*=\s*"crushxiangjian-v1"/.test(src));
  assert.match(src, /filter\(\(key\) => key !== CACHE_NAME\)/, "activate 必须清理旧版本缓存");
});
