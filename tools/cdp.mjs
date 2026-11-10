// 共用 CDP 启动配置：让 tools/ 下的测量脚本不再各写一份 Windows 绝对路径。
//
// 覆盖方式（不改代码）：
//   CHROME_PATH=/usr/bin/chromium       指定 Chrome/Chromium 可执行文件
//   CDP_PORT=9400                      所有脚本改用同一端口（避免并行抢端口）
//   CDP_BASE_URL=http://127.0.0.1:3456  本地站点地址
//
// 注意：这些脚本只用 CDP（Chrome DevTools Protocol）连系统浏览器，
// 不需要 Playwright / Puppeteer，也不下载 197MB 的 Chromium。

import { existsSync } from "node:fs";

const CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

export const CHROME = CANDIDATES.find((p) => existsSync(p)) || CANDIDATES[1];
export const CDP_BASE_URL = process.env.CDP_BASE_URL || "http://127.0.0.1:3456";
export const cdpPort = (fallback) => Number(process.env.CDP_PORT || fallback);

// 只在本机找不到浏览器时给一句明确提示，避免 spawn 抛出一串 ENOENT 让人摸不着头脑。
export function assertChrome() {
  if (!existsSync(CHROME)) {
    throw new Error(
      `找不到 Chrome/Chromium：${CHROME}\n请设置 CHROME_PATH=/path/to/chrome 后重试。`,
    );
  }
}
