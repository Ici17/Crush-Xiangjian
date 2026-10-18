/**
 * audit-question-count.ts —— 题数一致性门禁
 *
 * 为什么需要它：题数一改，散落各处的写死字面量不会自己跟上，而且**不报错、不崩溃**，
 * 只是悄悄显示错的文案（首页数据条、分享卡、后台漏斗……）。这是最难发现的一类缺陷：
 * 2026-10-18 加校准题（10 → 13 题）后，共发现 8 处漏改，其中两处最隐蔽：
 *   ① lib/useMyTestStatus.ts 的 setStatus 里 `totalCount: 10`
 *      —— 只改初始 state 没用，每次 read() 都会覆盖回去，等于没修
 *   ② app/api/admin/overview 的 `topN(..., 12)`
 *      —— 13 步取前 12，曝光最低的最后一步被静默截断、永远看不到
 *
 * 本门禁守三件事：
 *   A. 真源自洽：TOTAL_QUESTION_COUNT === BRANCH_QUESTION_MAX + CALIBRATION_ORDER.length
 *   B. 无残留字面量：app/ 与 lib/ 里不许再出现「/10」「10 题」这类写死题数
 *   C. 后台漏斗不断头：step 分布取的 N 必须 ≥ 总题数，否则最后一步会被截断
 */

import * as fs from "fs";
import * as path from "path";
import {
  BRANCH_QUESTION_MAX,
  CALIBRATION_ORDER,
  TOTAL_QUESTION_COUNT,
} from "@/lib/branchingQuestions";

let pass = 0;
let fail = 0;
const ok = (m: string) => { pass++; console.log(`  ✅ ${m}`); };
const no = (m: string) => { fail++; console.log(`  ❌ ${m}`); };

console.log("══════ 题数一致性门禁 ══════\n");

// ── A. 真源自洽 ──
console.log("A. 题数真源");
console.log(
  `  分支题最大 ${BRANCH_QUESTION_MAX} + 校准题 ${CALIBRATION_ORDER.length} = 总题数 ${TOTAL_QUESTION_COUNT}`,
);
TOTAL_QUESTION_COUNT === BRANCH_QUESTION_MAX + CALIBRATION_ORDER.length
  ? ok("TOTAL_QUESTION_COUNT 与两个组成部分一致")
  : no("TOTAL_QUESTION_COUNT 与组成部分不符（真源被改坏）");

// ── B. 残留字面量扫描 ──
console.log("\nB. 残留写死题数扫描");
const ROOT = path.join(process.cwd(), "srcOrRoot");
void ROOT;
const targets = ["app", "lib", "components"];
// 这两个文件里全是 priceRange（"¥600-900/100ml"），属价格不是题数，排除误报
const EXCLUDE_FILES = ["lib/data.ts", "lib/perfumes.extra.ts"];
const SUSPECT = /(\/10[）)]|10\s?题|10\s?道|totalCount:\s*10\b|共\s*10\s*题)/;

const hits: string[] = [];
function walk(dir: string) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next", ".git"].includes(entry.name)) continue;
      walk(p);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      const rel = p.split(path.sep).join("/").replace(/.*\/(app|lib|components)\//, "$1/");
      if (EXCLUDE_FILES.some((f) => rel.endsWith(f))) continue;
      const src = fs.readFileSync(p, "utf8");
      src.split("\n").forEach((line, i) => {
        // 跳过注释行：说明性文字里出现「10 题」是允许的
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        if (SUSPECT.test(line)) hits.push(`${rel}:${i + 1}  ${line.trim().slice(0, 90)}`);
      });
    }
  }
}
for (const t of targets) walk(path.join(process.cwd(), t));

if (hits.length === 0) {
  ok("app/ lib/ components/ 内无写死题数字面量");
} else {
  no(`发现 ${hits.length} 处疑似写死题数（应改用 TOTAL_QUESTION_COUNT）`);
  for (const h of hits.slice(0, 20)) console.log(`      ${h}`);
}

// ── C. 后台漏斗不断头 ──
console.log("\nC. 后台答题漏斗完整性");
const overviewPath = path.join(process.cwd(), "app", "api", "admin", "overview", "route.ts");
if (!fs.existsSync(overviewPath)) {
  no("找不到 app/api/admin/overview/route.ts");
} else {
  const src = fs.readFileSync(overviewPath, "utf8");
  const line = src.split("\n").find((l) => /step:\s*topN\(/.test(l));
  if (!line) {
    no("没找到 step 分布的 topN 调用");
  } else {
    // topN 的第一个实参里可能自带逗号（sumDim(range.days, 'step')），
    // 所以必须按括号深度找「第 0 层的那个逗号」，不能简单 split。
    const open = line.indexOf("topN(") + "topN(".length;
    let depth = 0;
    let comma = -1;
    let close = -1;
    for (let i = open; i < line.length; i++) {
      const ch = line[i];
      if (ch === "(") depth++;
      else if (ch === ")") {
        if (depth === 0) { close = i; break; }
        depth--;
      } else if (ch === "," && depth === 0) comma = i;
    }
    const arg = comma > -1 && close > comma
      ? line.slice(comma + 1, close).trim()
      : "";
    if (arg === "TOTAL_QUESTION_COUNT") {
      ok("step 分布取数上限引用 TOTAL_QUESTION_COUNT（题数再变也不会截断）");
    } else if (/^\d+$/.test(arg)) {
      const n = parseInt(arg, 10);
      n >= TOTAL_QUESTION_COUNT
        ? ok(`step 上限 ${n} ≥ 总题数 ${TOTAL_QUESTION_COUNT}`)
        : no(`step 上限 ${n} < 总题数 ${TOTAL_QUESTION_COUNT} → 最后 ${TOTAL_QUESTION_COUNT - n} 步会被静默截断`);
    } else {
      ok(`step 上限为表达式 ${arg}（非写死数字）`);
    }
  }
}

console.log(`\n══════ 结果：${pass} 通过 / ${fail} 失败 ══════`);
process.exit(fail > 0 ? 1 : 0);
