// shot.mjs —— 用 CDP 在真实移动模拟下截图（headless 的 --screenshot 会忽略 viewport meta，不能用）
// 用法：node tools/shot.mjs <url> <out.png> [width] [height]

import { spawn } from "node:child_process";
import { CHROME, CDP_BASE_URL, cdpPort } from "./cdp.mjs";
import { writeFileSync } from "node:fs";


const [, , URL_TARGET = CDP_BASE_URL + "/", OUT = ".data/shots/shot.png", W = "390", H = "844", P = "", SCROLL = ""] = process.argv;
const PORT = cdpPort(9334);
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

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: Number(W),
  height: Number(H),
  deviceScaleFactor: 2,
  mobile: true,
});
await send("Page.navigate", { url: URL_TARGET });
for (let i = 0; i < 20; i++) {
  const st = await send("Runtime.evaluate", { expression: "document.readyState" });
  if (st?.result?.result?.value === "complete") break;
  await sleep(500);
}
if (P) {
  await send("Runtime.evaluate", { expression: `localStorage.setItem('crushxiangjian_personality_id','${P}')` });
  await send("Page.reload");
  for (let i = 0; i < 20; i++) {
    const st = await send("Runtime.evaluate", { expression: "document.readyState" });
    if (st?.result?.result?.value === "complete") break;
    await sleep(500);
  }
  await sleep(2000);
}
if (SCROLL) {
  await send("Runtime.evaluate", { expression: `window.scrollTo(0, ${Number(SCROLL)})` });
  await sleep(1200);
}
await sleep(600);

const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
writeFileSync(OUT, Buffer.from(shot.result.data, "base64"));
console.log("saved", OUT);
ws.close();
chrome.kill();
process.exit(0);
