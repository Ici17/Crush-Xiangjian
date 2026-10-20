/**
 * scripts/_env.ts —— 让脚本也能读到 .env.local
 *
 * 为什么需要它：`next dev` / `next build` 会自动加载 .env.local，
 * 但用 `npx tsx scripts/xxx.ts` 直接跑脚本时**不会** —— 结果就是
 * env 明明配好了，脚本却报「缺少 AI_BASE_URL」。
 *
 * 用法：在脚本文件**第一行** `import "./_env";`
 *
 * 刻意零依赖（不装 dotenv）：只需要一个能读 KEY=VALUE 的解析器，
 * 不值得为此往项目里加一个包。
 */

import * as fs from "node:fs";
import * as path from "node:path";

function loadEnvFile(file: string): void {
  if (!fs.existsSync(file)) return;
  const raw = fs.readFileSync(file, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    // 去掉成对引号；行尾注释不处理（.env 里的值一般不含 #）
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    // 已存在的环境变量优先（便于命令行临时覆盖）
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

const local = path.join(process.cwd(), ".env.local");
loadEnvFile(local);
// .env 作为兜底（项目里一般没有，留着以防别人建了）
loadEnvFile(path.join(process.cwd(), ".env"));

export {};
