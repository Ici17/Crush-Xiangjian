import { spawn } from "node:child_process";
import { CHROME, CDP_BASE_URL, cdpPort } from "./_chrome.mjs";

const PORT = cdpPort(9338);
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
await send("Page.navigate", { url: CDP_BASE_URL + "/result" });
await sleep(3000);
await ev("localStorage.setItem('crushxiangjian_personality_id','anliu')");
await send("Page.reload");
await sleep(6000);

console.log("url:", await ev("location.href"));
console.log("nav 元素数:", await ev("document.querySelectorAll('nav').length"));
console.log("nav aria:", await ev("[...document.querySelectorAll('nav')].map(n=>n.getAttribute('aria-label')).join(',')"));
console.log("正文前 120 字:", (await ev("document.body.innerText") || "").slice(0, 120).replace(/\n/g, " | "));
console.log("有 sec-contrast:", await ev("!!document.getElementById('sec-contrast')"));
console.log("折叠按钮:", await ev("[...document.querySelectorAll('button')].filter(b=>/展开|收起|各场合/.test(b.textContent)).map(b=>b.textContent.trim()).join(' / ')"));
ws.close();
chrome.kill();
process.exit(0);
