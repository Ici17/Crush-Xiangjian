import { spawn } from "node:child_process";
import { CHROME, CDP_BASE_URL, cdpPort } from "./cdp.mjs";

const PORT = cdpPort(9343);
const URL_TARGET = process.argv[2] || CDP_BASE_URL + "/result";
const W = Number(process.argv[3] || 390);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const chrome = spawn(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", `--remote-debugging-port=${PORT}`, "about:blank"]);
let ws;
for (let i = 0; i < 30; i++) {
  try {
    const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const p = l.find((t) => t.type === "page");
    if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; }
  } catch {}
  await sleep(300);
}
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0;
const pend = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (m, p = {}) => { const i = ++id; ws.send(JSON.stringify({ id: i, method: m, params: p })); return new Promise((r) => pend.set(i, r)); };
const ev = async (x) => (await send("Runtime.evaluate", { expression: x, returnByValue: true, awaitPromise: true })).result?.result?.value;

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: W, height: 844, deviceScaleFactor: 2, mobile: true });
await send("Page.navigate", { url: URL_TARGET });
await sleep(2500);
await ev("localStorage.setItem('crushxiangjian_personality_id','anliu')");
await send("Page.reload");
for (let i = 0; i < 24; i++) {
  const ready = await ev('document.readyState === "complete" && !!document.querySelector(\'nav[aria-label="报告章节导航"]\')');
  if (ready) break;
  await sleep(600);
}
await sleep(800);

const EXPR = [
  "(() => {",
  "  const rect = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.x), right: Math.round(b.right), w: Math.round(b.width) }; };",
  "  const nav = document.querySelector('nav[aria-label=\"报告章节导航\"]');",
  "  const link = document.querySelector('a[aria-label=\"去探索页搜索香水\"]');",
  "  const badge = nav && nav.querySelector('[role=\"status\"]');",
  "  const wide = [...document.querySelectorAll('body *')]",
  "    .map((e) => ({ e, b: e.getBoundingClientRect() }))",
  "    .filter((o) => o.b.width > innerWidth + 1)",
  "    .slice(0, 8)",
  "    .map((o) => o.e.tagName + '.' + String(o.e.className || '').slice(0, 44) + ' w=' + Math.round(o.b.width) + ' x=' + Math.round(o.b.x));",
  "  const shell = document.querySelector('.app-shell');",
  "  return JSON.stringify({",
  "    innerW: innerWidth,",
  "    docW: document.documentElement.scrollWidth,",
  "    bodyW: Math.round(document.body.getBoundingClientRect().width),",
  "    shellW: shell ? Math.round(shell.getBoundingClientRect().width) : null,",
  "    nav: rect(nav),",
  "    search: rect(link),",
  "    badge: badge ? badge.textContent.trim() : null,",
  "    mainStyle: (() => { const m = document.querySelector('main.app-shell'); if (!m) return null; const c = getComputedStyle(m); return { width: c.width, maxWidth: c.maxWidth, minWidth: c.minWidth, display: c.display, position: c.position, margin: c.margin, zoom: c.zoom }; })(),",
  "    htmlStyle: (() => { const c = getComputedStyle(document.documentElement); return { width: c.width, fontSize: c.fontSize, zoom: c.zoom }; })(),",
  "    wide,",
  "  }, null, 2);",
  "})()",
].join("\n");

console.log(await ev(EXPR));
ws.close();
chrome.kill();
process.exit(0);
