// ============================================================
// measure.mjs —— 用 Chrome DevTools Protocol 量首页首屏（不依赖 Playwright）
//
// 为什么需要它：首页转化只有 2.4%，要判断是「CTA 在折叠线下」还是「横向溢出」，
// 必须拿到**真实渲染后的**坐标（scrollWidth / CTA top / 超宽元素）。
// Playwright 浏览器下载 197MB 卡住，直接用系统 Chrome + CDP 更快。
//
// 用法：node tools/measure.mjs [url]
// ============================================================

import { spawn } from "node:child_process";
import { CHROME, cdpPort } from "./cdp.mjs";


const URL_TARGET = process.argv[2] || "https://crushxiangjian.com/";
const PORT = cdpPort(9333);
const DEVICES = [
  { name: "iPhone 13 (390x844)", width: 390, height: 844, dsf: 3, mobile: true },
  { name: "iPhone SE (375x667)", width: 375, height: 667, dsf: 2, mobile: true },
  { name: "Desktop (1280x800)", width: 1280, height: 800, dsf: 1, mobile: false },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  "--no-default-browser-check",
  `--remote-debugging-port=${PORT}`,
  "about:blank",
]);

async function openWs() {
  for (let i = 0; i < 30; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return new WebSocket(page.webSocketDebuggerUrl);
    } catch {}
    await sleep(300);
  }
  throw new Error("连不上 Chrome CDP");
}

const ws = await openWs();
await new Promise((res, rej) => {
  ws.onopen = res;
  ws.onerror = rej;
});

let id = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
function send(method, params = {}) {
  const myId = ++id;
  ws.send(JSON.stringify({ id: myId, method, params }));
  return new Promise((res) => pending.set(myId, res));
}

await send("Page.enable");
await send("Runtime.enable");

const EXPR = `(() => {
  const r = (e) => { const b = e.getBoundingClientRect(); return { x: Math.round(b.x), w: Math.round(b.width), top: Math.round(b.top + scrollY), h: Math.round(b.height) }; };
  const cta = document.querySelector('button[aria-label="开始寻找我的本命香"]');
  const shell = document.querySelector('.app-shell');
  const wide = [...document.querySelectorAll('body *')]
    .map((e) => ({ e, b: e.getBoundingClientRect() }))
    .filter(({ b }) => b.width > innerWidth + 2)
    .slice(0, 6)
    .map(({ e, b }) => (e.tagName + '.' + String(e.className || '').slice(0, 34) + ' w=' + Math.round(b.width)));
  return JSON.stringify({
    docW: document.documentElement.scrollWidth,
    bodyW: document.body.scrollWidth,
    innerW: innerWidth, innerH: innerHeight,
    shell: shell ? r(shell) : null,
    cta: cta ? r(cta) : null,
    wide,
  });
})()`;

for (const d of DEVICES) {
  await send("Emulation.setDeviceMetricsOverride", {
    width: d.width,
    height: d.height,
    deviceScaleFactor: d.dsf,
    mobile: d.mobile,
  });
  await send("Page.navigate", { url: URL_TARGET });
  // 等页面真的解析完（移动模拟下首次加载常超过 3s，固定 sleep 会拿到 null document）
  for (let i = 0; i < 20; i++) {
    const st = await send("Runtime.evaluate", { expression: "document.readyState" });
    if (st?.result?.result?.value === "complete") break;
    await sleep(500);
  }
  await sleep(1500); // 等字体与入场动画落定
  const res = await send("Runtime.evaluate", { expression: EXPR, returnByValue: true });
  const raw = res?.result?.result?.value;
  if (raw === undefined) {
    console.log("   ⚠️ evaluate 无返回值：", JSON.stringify(res).slice(0, 400));
    continue;
  }
  const data = JSON.parse(raw);
  const ctaVisible = data.cta ? data.cta.top < data.innerH : false;
  console.log(`\n── ${d.name}`);
  console.log(`   文档宽 ${data.docW} / body ${data.bodyW} / 视口 ${data.innerW}x${data.innerH}`);
  if (data.shell) console.log(`   .app-shell: x=${data.shell.x} w=${data.shell.w}`);
  if (data.cta) {
    console.log(`   CTA: top=${data.cta.top} h=${data.cta.h} → ${ctaVisible ? "✅ 首屏可见" : `❌ 折叠线下（差 ${data.cta.top - data.innerH}px）`}`);
  } else {
    console.log("   CTA: 未找到（可能已抽过签，CTA 被替换）");
  }
  if (data.wide?.length) console.log(`   超宽元素: ${data.wide.join(" | ")}`);
}

ws.close();
chrome.kill();
process.exit(0);
