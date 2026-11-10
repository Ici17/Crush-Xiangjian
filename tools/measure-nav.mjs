import { spawn } from "node:child_process";
import { CHROME, cdpPort } from "./_chrome.mjs";

const PORT = cdpPort(9340);
const URL_TARGET = process.argv[2] || "https://crushxiangjian.com/result";
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
await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send("Page.navigate", { url: URL_TARGET });
await sleep(3000);
await ev("localStorage.setItem('crushxiangjian_personality_id','anliu')");
await send("Page.reload");
await sleep(6000);

const out = await ev(`(() => {
  const nav = document.querySelector('nav[aria-label="报告章节导航"]');
  if (!nav) return JSON.stringify({ error: 'no nav' });
  const navRect = nav.getBoundingClientRect();
  const prev = document.querySelector('[aria-label="人格揭晓"]');
  const next = nav.nextElementSibling;
  const h3 = next ? next.querySelector('h3') : null;
  const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height) }; };
  const prevRect = prev ? prev.getBoundingClientRect() : null;
  const h3Rect = h3 ? h3.getBoundingClientRect() : null;
  return JSON.stringify({
    nav: r(nav),
    prevTag: prev ? prev.tagName + '.' + String(prev.className).slice(0, 40) : null,
    prev: r(prev),
    nextTag: next ? next.tagName + '#' + next.id : null,
    h3: r(h3),
    gapAbove: prevRect ? Math.round(navRect.top - prevRect.bottom) : null,
    gapBelow: h3Rect ? Math.round(h3Rect.top - navRect.bottom) : null,
    navPadTop: getComputedStyle(nav.firstElementChild).paddingTop,
    navPadBottom: getComputedStyle(nav.firstElementChild).paddingBottom,
    h3MarginTop: h3 ? getComputedStyle(h3).marginTop : null,
    sectionPadTop: next ? getComputedStyle(next).paddingTop : null,
  });
})()`);

console.log(out);
ws.close();
chrome.kill();
process.exit(0);
