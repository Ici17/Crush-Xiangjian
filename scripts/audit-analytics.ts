/**
 * 埋点自检（2026-09-16）
 *
 * 埋点最危险的两类问题**都是静默的**，靠人工 review 守不住：
 *   1. 事件定义了却没人调用 —— 看板上永远是 0，看起来像「业务没发生」。
 *      （本轮发现的 `unlock_success` 就是这样：付费漏斗末段恒 0%，被误读成没人付费）
 *   2. `track('拼写错了')` —— 服务端 normalizeEvent 直接丢弃，不报错、不打日志。
 *
 * 断言：
 *   A. 源码里出现的每个 track() 事件名都在白名单内（抓拼写错 / 大小写错）
 *   B. 每个已定义事件至少有一个调用点（抓死埋点）
 *   C. EVENT_LABEL 与 TRACK_EVENTS 键集合完全一致（抓漏加标签 / 残留已删事件的标签）
 *   D. store.ts 的 READ_DIMS 直接引用 DIM_KEYS（抓第二份维度副本）
 *   E. ANALYTICS_EVENTS 派生自 TRACK_EVENTS（抓第二份事件副本）
 *   H. 事件总数 === 29 且 KV 每日布局 = DIM_KEYS.length + 4（抓 layout 被改回硬编码）
 * 提示（不计失败）：
 *   F. 某事件的 props key 不在 DIM_KEYS 内 → 该字段不会被分维度聚合，只会留在原始事件流
 *   G. 哪些 DIM_KEY 目前没有任何事件在用（属预留，不是错误）
 *
 * 运行：npx tsx scripts/audit-analytics.ts
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { TRACK_EVENTS, EVENT_SET, EVENT_LABEL, DIM_KEYS, AUTO_EVENT_SET } from "../lib/analytics/events";
import { KV_DAY_COMMANDS } from "../lib/analytics/store";

let pass = 0;
let fail = 0;
let warn = 0;

function ck(cond: boolean, label: string, detail = "") {
  if (cond) {
    pass++;
    console.log(`  OK   ${label}`);
  } else {
    fail++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function wk(detail: string) {
  warn++;
  console.log(`  WARN ${detail}`);
}

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "lib"];

function walk(dir: string, out: string[] = []): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of names) {
    const p = join(dir, name);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** 埋点定义文件自身不参与「调用点」统计 */
function isDefinitionFile(rel: string): boolean {
  const norm = rel.split(sep).join("/");
  return norm === "lib/analytics.ts" || norm.startsWith("lib/analytics/");
}

/**
 * 剥离注释（2026-09-16 QA 修 P3-3）：
 * 调用点扫描此前不剥离注释 —— 注释掉的 `track('x')` 仍被算作「有调用点」，
 * B 项（死埋点）会漏报。本脚本自己的注释里就写着 track('拼写错了')，隐患真实。
 *
 * 保守实现：**必须先保护字符串 / 模板字面量**，否则 URL 里的 `//`（如 'https://…'）
 * 会把后续代码整段误删。逐字符扫描：遇引号整段复制到闭合引号（含转义），
 * 遇 `//` 丢弃到行尾、遇 `/* *\/` 丢弃到闭合（块注释保留换行，维持行结构）。
 * 已知边界：不区分 JSX 文本态 —— JSX 文本里裸写的 `//` 会被当作行注释（当前代码库无此写法）。
 */
function stripComments(src: string): string {
  let out = "";
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src.charAt(i);
    const d = src.charAt(i + 1);
    if (c === "/" && d === "/") {
      i += 2;
      while (i < n && src.charAt(i) !== "\n") i += 1;
      continue;
    }
    if (c === "/" && d === "*") {
      i += 2;
      while (i < n && !(src.charAt(i) === "*" && src.charAt(i + 1) === "/")) {
        if (src.charAt(i) === "\n") out += "\n";
        i += 1;
      }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      out += c;
      i += 1;
      while (i < n) {
        const ch = src.charAt(i);
        if (ch === "\\") {
          out += ch + src.charAt(i + 1);
          i += 2;
          continue;
        }
        out += ch;
        i += 1;
        if (ch === c) break;
      }
      continue;
    }
    out += c;
    i += 1;
  }
  return out;
}

const files: string[] = [];
for (const d of SCAN_DIRS) walk(join(ROOT, d), files);

const CALL_RE = /\btrack\s*\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g;
const PROPS_RE = /\btrack\s*\(\s*['"]([A-Za-z_][A-Za-z0-9_]*)['"]\s*,\s*\{([^}]*)\}/g;

/** 事件名 → 出现过的文件（相对路径） */
const calls = new Map<string, string[]>();
/** 事件名 → 该事件传过的 props key */
const propsByEvent = new Map<string, Set<string>>();
const allPropKeys = new Set<string>();

for (const abs of files) {
  const rel = relative(ROOT, abs);
  if (isDefinitionFile(rel)) continue;
  // 剥离注释后再扫描：注释掉的 track('x') 不得算作调用点（否则 B 项漏报死埋点）
  const text = stripComments(readFileSync(abs, "utf8"));

  for (const m of text.matchAll(CALL_RE)) {
    const ev = m[1];
    const arr = calls.get(ev);
    if (arr) arr.push(rel);
    else calls.set(ev, [rel]);
  }

  for (const m of text.matchAll(PROPS_RE)) {
    const ev = m[1];
    let set = propsByEvent.get(ev);
    if (!set) {
      set = new Set();
      propsByEvent.set(ev, set);
    }
    // 同时覆盖 `key: value` 与 ES6 简写 `{ cta }`。
    // 末尾的 `$` 分支必不可少：捕获组已把右花括号剥离，`{ cta }` 取到的是 " cta "，
    // 只允许 [:,\}] 做后继的话简写属性会被整体漏检（曾把在用的 cta 误报成未使用）。
    for (const km of m[2].matchAll(/(?:^|[,{])\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?=\s*[:,\}]|$)/g)) {
      set.add(km[1]);
      allPropKeys.add(km[1]);
    }
  }
}

const defined = TRACK_EVENTS as readonly string[];
const dimSet: ReadonlySet<string> = new Set(DIM_KEYS as readonly string[]);

console.log(`扫描 ${files.length} 个 .ts/.tsx 文件\n`);

// ── A. 事件名白名单 ──────────────────────────────
console.log("A. 事件名白名单（抓拼写错 —— 拼错会被服务端静默丢弃）");
const unknown = [...calls.keys()].filter((e) => !EVENT_SET.has(e));
ck(
  unknown.length === 0,
  `源码里出现的 track() 事件名全部合法（发现 ${calls.size} 个不同事件名）`,
  unknown.map((e) => `${e}（${[...new Set(calls.get(e)!)].join(", ")}）`).join("；"),
);

// ── B. 死埋点 ────────────────────────────────────
console.log("B. 死埋点（定义了但没有任何调用点）");
// 自动事件（session_start / error）由 lib/analytics.ts 运行时触发，只定义在「定义文件」内，
// 而定义文件被调用点扫描跳过 → 不能算死埋点；此处显式豁免（AUTO_EVENT_SET 来自 events.ts 单一真源）。
const dead = defined.filter((e) => !calls.has(e) && !AUTO_EVENT_SET.has(e));
ck(
  dead.length === 0,
  `每个已定义事件都有调用点（共 ${defined.length} 个，其中 ${AUTO_EVENT_SET.size} 个为运行时自动触发）`,
  `无调用点：${dead.join(", ")}`,
);

// ── C. 事件标签 ──────────────────────────────────
console.log("C. 事件标签（看板 / CSV 的中文名）");
const labelKeys = new Set(Object.keys(EVENT_LABEL));
const missingLabel = defined.filter((e) => !labelKeys.has(e));
const extraLabel = [...labelKeys].filter((k) => !EVENT_SET.has(k));
ck(missingLabel.length === 0, "EVENT_LABEL 覆盖全部事件", `缺标签：${missingLabel.join(", ")}`);
ck(extraLabel.length === 0, "EVENT_LABEL 无残留键", `多余（事件已删？）：${extraLabel.join(", ")}`);

// ── D / E. 单一真源 ──────────────────────────────
console.log("D. 单一真源（防止第二份手工副本漂移）");
const storeSrc = readFileSync(join(ROOT, "lib", "analytics", "store.ts"), "utf8");
ck(
  /const\s+READ_DIMS[^=\n]*=\s*DIM_KEYS/.test(storeSrc),
  "store.ts 的 READ_DIMS 直接引用 DIM_KEYS",
  "疑似又写了一份手工维度数组 —— 历史上它少了 format，导致 KV 与 Supabase 驱动口径不一致且不报错",
);
const analyticsSrc = readFileSync(join(ROOT, "lib", "analytics.ts"), "utf8");
ck(
  /ANALYTICS_EVENTS[^=\n]*=\s*TRACK_EVENTS/.test(analyticsSrc),
  "analytics.ts 的 ANALYTICS_EVENTS 派生自 TRACK_EVENTS",
  "疑似又写了一份手工事件数组",
);

// ── F. props 维度归集（提示）─────────────────────
console.log("F. props 维度归集（提示）");
const unknownProps = [...allPropKeys].filter((k) => !dimSet.has(k));
if (unknownProps.length) {
  wk(
    `以下 props 未登记在 DIM_KEYS，不会被分维度聚合（只留在原始事件流）：${unknownProps.join(", ")}` +
      `\n        → 若希望看板能按它筛选/排序，请加进 lib/analytics/events.ts 的 DIM_KEYS`,
  );
} else {
  pass++;
  console.log(`  OK   所有 track props 都在 DIM_KEYS 内（共 ${allPropKeys.size} 个 key）`);
}

// ── G. 未使用的维度（提示）───────────────────────
console.log("G. 未被使用的维度（提示）");
// path / ref 由 track 统一携带为**顶层字段**（服务端再并入 props），不写在调用点的 props 里，故排除
const TOP_LEVEL_DIMS: readonly string[] = ["path", "ref"];
const unusedDims = DIM_KEYS.filter((k) => !TOP_LEVEL_DIMS.includes(k) && !allPropKeys.has(k));
if (unusedDims.length) {
  wk(
    `以下维度暂无事件在用（属预留，非错误）：${unusedDims.join(", ")}` +
      `\n        → 若长期不用可考虑从 DIM_KEYS 移除；重新启用只需加回一处（本脚本会守住一致性）`,
  );
} else {
  pass++;
  console.log("  OK   所有维度都至少被一个事件使用");
}

// ── H. 事件总数 / KV 每日布局门禁（第 2 批）───────
console.log("H. 事件总数与 KV 每日布局门禁");
ck(
  defined.length === 29,
  `事件总数 === 29（当前 ${defined.length}）`,
  `实际 ${defined.length} —— 第 2 批目标 22 → 29（新增 7 个）`,
);
// KV 每日 layout = counts + uv + sess + sstart + 各 DIM_KEYS，共 DIM_KEYS.length + 4。
// 该断言守住「读写共享同一份 layout」：一旦有人把 store.ts 改回硬编码下标，这里立刻红。
ck(
  KV_DAY_COMMANDS === DIM_KEYS.length + 4,
  `KV 每日命令数 === DIM_KEYS.length + 4（${KV_DAY_COMMANDS} === ${DIM_KEYS.length} + 4）`,
  "疑似 store.ts 的 KV 每日 layout 被改回硬编码，读写会静默错位",
);
const autoNotDefined = [...AUTO_EVENT_SET].filter((e) => !EVENT_SET.has(e));
ck(
  autoNotDefined.length === 0,
  "AUTO_EVENTS（运行时自动事件）均在 TRACK_EVENTS 内",
  `多余：${autoNotDefined.join(", ")}`,
);
// E1（QA 补强，2026-09-16）：堵住 B 项后门。
// 仅有「AUTO_EVENTS ⊆ TRACK_EVENTS」是不够的 —— 任何人把「真死埋点」塞进 AUTO_EVENTS，
// B 项就会豁免它，门禁形同虚设。运行时自动事件必须在 lib/analytics.ts（自动上报实现）里真实出现。
const autoMissingImpl = [...AUTO_EVENT_SET].filter(
  (e) => !new RegExp(`['"\`]${e.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"\`]`).test(analyticsSrc),
);
ck(
  autoMissingImpl.length === 0,
  "AUTO_EVENTS 均在 lib/analytics.ts 源码中真实出现（锁死 B 项后门）",
  `疑似把死埋点塞进 AUTO_EVENTS 以绕过 B 项：${autoMissingImpl.join(", ")}`,
);

console.log(`\n结果：${pass} 通过 / ${fail} 失败${warn ? ` / ${warn} 提示` : ""}`);
process.exit(fail ? 1 : 0);
