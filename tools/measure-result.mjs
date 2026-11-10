// measure-result.mjs —— 量结果页的真实长度与付费墙位置（CDP + localStorage 注入）
// 用法：node tools/measure-result.mjs [url]

import { spawn } from "node:child_process";
import { CHROME, cdpPort } from "./cdp.mjs";


const URL_TARGET = process.argv[2] || "https://crushxiangjian.com/result";
const PORT = cdpPort(9335);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  `--remote-debugging-port=${PORT}`,
  "about:blank",
]);

let ws;
for (let i = 0; i < 30; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const page = list.find((t) => t.type === "page");
    if (page?.webSocketDebuggerUrl) {
      ws = new WebSocket(page.webSocketDebuggerUrl);
      break;
    }
  } catch {}
  await sleep(300);
}
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});
let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
};
const send = (method, params = {}) => {
  const myId = ++id;
  ws.send(JSON.stringify({ id: myId, method, params }));
  return new Promise((res) => pending.set(myId, res));
};
const evalJs = async (expression) => {
  const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  return r?.result?.result?.value;
};

async function waitReady() {
  for (let i = 0; i < 24; i++) {
    if ((await evalJs("document.readyState")) === "complete") break;
    await sleep(400);
  }
  await sleep(2500);
}

const MEASURE = `(() => {
  const H = innerHeight;
  const top = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return Math.round(el.getBoundingClientRect().top + scrollY);
  };
  const anchors = {
    付费墙: top('[aria-label="解锁完整报告"]'),
    本命香水: top('[aria-label="本命香水推荐"]'),
    隐藏人格面: top('[aria-label="隐藏人格面"]'),
    反差香: top('[aria-label="反差香"]'),
    气味底稿: top('[aria-label="气味底稿"]'),
    朋友匹配: top('[aria-label="朋友匹配入口"]'),
  };
  return JSON.stringify({
    viewportH: H,
    totalH: document.documentElement.scrollHeight,
    screens: +(document.documentElement.scrollHeight / H).toFixed(1),
    anchors,
    sections: [...document.querySelectorAll('section[aria-label]')].map((e) => e.getAttribute('aria-label')),
    paid: localStorage.getItem('crushxiangjian_paid_v2'),
    hasDeep: document.body.innerText.includes('更 深 一 层'),
    hasPaywall: /解锁完整|限时|原价/.test(document.body.innerText),
    firstHeading: (document.querySelector('h1,h2') || {}).innerText || '',
  });
})()`;

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

// 1) 未解锁态（有测试结果、没付费）
await send("Page.navigate", { url: URL_TARGET });
await waitReady();
await evalJs(`localStorage.setItem('crushxiangjian_personality_id','anliu');
  localStorage.removeItem('crushxiangjian_paid_v2'); 'ok'`);
await send("Page.reload");
await waitReady();
const free = JSON.parse((await evalJs(MEASURE)) ?? "{}");

// 2) 已解锁态
await evalJs(`localStorage.setItem('crushxiangjian_paid_v2','3'); 'ok'`);
await send("Page.reload");
await waitReady();
const paid = JSON.parse((await evalJs(MEASURE)) ?? "{}");

const fmt = (label, d) => {
  if (!d.totalH) return console.log(`\n── ${label}: 没量到（页面可能重定向）`);
  console.log(`\n── ${label}`);
  console.log(`   视口 ${d.viewportH}px · 总高 ${d.totalH}px · **${d.screens} 屏**`);
  for (const [k, v] of Object.entries(d.anchors || {})) {
    if (v === null) continue;
    console.log(`   ${k}: 第 ${(v / d.viewportH + 1).toFixed(1)} 屏（top=${v}px）`);
  }
  console.log(`   section 数: ${(d.sections || []).length}`);
  console.log(`   paid_v2=${d.paid} · 含解锁深度文案=${d.hasDeep} · 含付费墙文案=${d.hasPaywall}`);
};

fmt("未解锁态", free);
fmt("已解锁态", paid);
ws.close();
chrome.kill();
process.exit(0);
