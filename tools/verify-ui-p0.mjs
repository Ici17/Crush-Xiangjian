// 第 0 期 UI P0 实测：导航视觉高度不变 / 44px 命中区真的可点 /
// tokens 变量生效 / prefers-reduced-motion 降级生效 / 窄屏无横向溢出。
// 用法：node tools/verify-ui-p0.mjs [宽度=390]
import { spawn } from "node:child_process";
import { CHROME, CDP_BASE_URL, cdpPort } from "./_chrome.mjs";


const PORT = cdpPort(9344);
const W = Number(process.argv[2] || 390);
const TARGET = CDP_BASE_URL + "/result";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
  `--remote-debugging-port=${PORT}`, "about:blank",
]);
let ws;
for (let i = 0; i < 30; i++) {
  try {
    const l = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
    const p = l.find((t) => t.type === "page");
    if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; }
  } catch {}
  await sleep(300);
}
if (!ws) { console.error("CDP connect failed"); chrome.kill(); process.exit(1); }
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0;
const pend = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); }
};
const send = (method, params = {}) => {
  const i = ++id;
  ws.send(JSON.stringify({ id: i, method, params }));
  return new Promise((r) => pend.set(i, r));
};
const ev = async (x) => (await send("Runtime.evaluate", {
  expression: x, returnByValue: true, awaitPromise: true,
})).result?.result?.value;

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: W, height: 844, deviceScaleFactor: 2, mobile: true });
await send("Page.navigate", { url: TARGET });
await sleep(1800);
await ev("localStorage.setItem('crushxiangjian_personality_id','anliu')");
await send("Page.reload");
for (let i = 0; i < 24; i++) {
  const ready = await ev('document.readyState === "complete" && !!document.querySelector(\'nav[aria-label="报告章节导航"]\')');
  if (ready) break;
  await sleep(500);
}
await sleep(600);

const EXPR = `(() => {
  const nav = document.querySelector('nav[aria-label="报告章节导航"]');
  if (!nav) return JSON.stringify({ error: 'nav not found' });
  const btn = nav.querySelector('button.tap-44-y');
  const link = nav.querySelector('a.tap-44');
  const scroller = nav.querySelector('.overflow-x-auto');
  const shell = document.querySelector('.app-shell');
  const r = (e) => { const b = e.getBoundingClientRect(); return { x: +b.x.toFixed(1), y: +b.y.toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), bottom: +b.bottom.toFixed(1), right: +b.right.toFixed(1) }; };
  const bb = r(btn), lb = r(link);
  const who = (e) => e ? e.tagName + (e.getAttribute('aria-label') ? '[' + e.getAttribute('aria-label') + ']' : '') + ':' + (e.textContent || '').trim().slice(0, 6) : null;
  // 视觉盒之外 8px 处，命中区生效时应仍命中按钮/链接
  // 44px 热区相对 31.5px 视觉盒，上下各扩约 6.25px：6px 应命中，10px 应落空
  const hits = {
    above6: who(document.elementFromPoint(bb.x + bb.w / 2, bb.y - 6)),
    below6: who(document.elementFromPoint(bb.x + bb.w / 2, bb.bottom + 6)),
    above10_shouldMiss: who(document.elementFromPoint(bb.x + bb.w / 2, bb.y - 10)),
    center: who(document.elementFromPoint(bb.x + bb.w / 2, bb.y + bb.h / 2)),
    searchRight8: who(document.elementFromPoint(lb.right + 8, lb.y + lb.h / 2)),
    searchCenter: who(document.elementFromPoint(lb.x + lb.w / 2, lb.y + lb.h / 2)),
  };
  const probe = document.createElement('div');
  probe.className = 'animate-fadeIn';
  document.body.appendChild(probe);
  const animDur = getComputedStyle(probe).animationDuration;
  probe.remove();
  const ps = getComputedStyle(btn, '::after');
  const pseudo = {
    content: ps.content, position: ps.position, height: ps.height,
    width: ps.width, top: ps.top, left: ps.left, right: ps.right,
    transform: ps.transform, pointerEvents: ps.pointerEvents, display: ps.display,
  };
  const all = [...document.querySelectorAll('body *')].map((e) => ({ e, b: e.getBoundingClientRect() }));
  const desc = (o) => o.e.tagName + '.' + String(o.e.className || '').slice(0, 36) + ' right=' + o.b.right.toFixed(1) + ' w=' + o.b.width.toFixed(1);
  const wide = all.filter((o) => o.b.right > innerWidth + 0.5 && o.b.width > 0).slice(0, 8).map(desc);
  const nearEdge = all.filter((o) => o.b.right > innerWidth - 2 && o.b.right < innerWidth + 3 && o.b.width > 0).slice(0, 10).map(desc);
  return JSON.stringify({
    htmlScrollW: document.documentElement.scrollWidth,
    bodyScrollW: document.body.scrollWidth,
    bodyOverflowX: getComputedStyle(document.body).overflowX,
    nearEdge,
    pseudo,
    btnPosition: getComputedStyle(btn).position,
    scrollerOverflow: scroller ? [getComputedStyle(scroller).overflowX, getComputedStyle(scroller).overflowY] : null,
    wide,
    innerW: innerWidth,
    docW: document.documentElement.scrollWidth,
    noHOverflow: document.documentElement.scrollWidth <= innerWidth,
    shellW: shell ? +shell.getBoundingClientRect().width.toFixed(1) : null,
    navH: nav.offsetHeight,
    scrollerH: scroller ? scroller.offsetHeight : null,
    btnVisual: { w: bb.w, h: bb.h },
    linkVisual: { w: lb.w, h: lb.h },
    btnBg: getComputedStyle(btn).backgroundColor,
    tokenCream: getComputedStyle(document.documentElement).getPropertyValue('--cx-cream').trim(),
    tokenTap: getComputedStyle(document.documentElement).getPropertyValue('--cx-tap-min').trim(),
    animDur,
    hits,
  }, null, 2);
})()`;

console.log("=== normal motion / W=" + W + " ===");
console.log(await ev(EXPR));

await send("Emulation.setEmulatedMedia", {
  media: "screen",
  features: [{ name: "prefers-reduced-motion", value: "reduce" }],
});
await sleep(300);
console.log("=== prefers-reduced-motion: reduce ===");
console.log(await ev(EXPR));

ws.close();
chrome.kill();
process.exit(0);
