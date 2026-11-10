import { spawn } from "node:child_process";
import { CHROME, cdpPort } from "./_chrome.mjs";

const PORT = cdpPort(9341);
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
  const navs = [...document.querySelectorAll('nav[aria-label="报告章节导航"] button')].map(b => b.textContent.trim());
  const ids = ['sec-spectrum','sec-perfume','sec-personality','sec-philosophy','sec-preference','sec-relation','sec-hidden','sec-contrast','sec-blueprint'];
  const sections = ids.map(id => {
    const sec = document.getElementById(id);
    if (!sec) return { id, heading: null };
    const h = sec.querySelector('h2, h3, h4');
    return { id, heading: h ? h.textContent.trim() : null };
  });
  return JSON.stringify({ navs, sections });
})()`);

const data = JSON.parse(out);
console.log("导航胶囊:", data.navs.join(" / "));
console.log("");
console.log("区块实际标题:");
for (const s of data.sections) {
  const navLabel = data.navs.find((n) => s.heading && (s.heading.includes(n) || n.includes(s.heading)));
  const exact = navLabel && navLabel === s.heading;
  console.log(`  ${s.id.padEnd(16)} ${(s.heading || "(无标题)").padEnd(14)} ${exact ? "⚠️ 与导航完全相同" : ""}`);
}
ws.close();
chrome.kill();
process.exit(0);
