/**
 * audit-a11y.ts —— 交互可达性 / 动效偏好的源码契约门禁（第 14 个）
 *
 * 为什么是「源码契约」而不是渲染级检查：
 *   项目已有 13 个静态数据门禁，CI 里一条 glob 就能全跑，不需要浏览器。
 *   渲染级（真实命中区、动画时长、窄屏溢出）由 tools/verify-ui-p0.mjs
 *   用 CDP 实测覆盖，两者不重复。
 *
 * 守住的四类回归：
 *   A. 图标按钮没有 aria-label（屏幕阅读器读成「链接」）
 *   B. 折叠按钮丢 aria-expanded / 渐隐层没标 aria-hidden
 *   C. 44px 命中区被改回写死高度，或视觉盒被撑高
 *   D. prefers-reduced-motion 降级被删（尤其 framer-motion 的 JS 动画，
 *      CSS 侧再全也覆盖不到，必须保留 MotionConfig）
 *
 * ⚠️ 新增门禁必须反向验证真能报警：本脚本落地时已做过一次人为破坏测试。
 */

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");
const exists = (p: string) => existsSync(join(ROOT, p));

let pass = 0;
let fail = 0;
const ok = (m: string) => { pass++; console.log(`  ✅ ${m}`); };
const no = (m: string) => { fail++; console.log(`  ❌ ${m}`); };
const has = (label: string, file: string, needle: string) => {
  if (!exists(file)) { no(`${label}（文件缺失：${file}）`); return; }
  read(file).includes(needle) ? ok(label) : no(`${label}（${file} 里缺 ${needle}）`);
};

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  const abs = join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const name of readdirSync(abs)) {
    const p = join(abs, name);
    if (statSync(p).isDirectory()) out.push(...walkTsx(join(dir, name)));
    else if (/\.(tsx|jsx)$/.test(name)) out.push(relative(ROOT, p).replace(/\\/g, "/"));
  }
  return out;
}

console.log("A. 图标按钮与导航的无障碍标注");

has("章节导航有 aria-label", "components/ResultSectionNav.tsx", 'aria-label="报告章节导航"');
has("搜索图标链接有 aria-label", "components/ResultSectionNav.tsx", 'aria-label="去探索页搜索香水"');
has("搜索图标 svg 标了 aria-hidden", "components/ResultSectionNav.tsx", "aria-hidden");

// 通用规则：开标签后面紧跟 <svg 的交互元素（纯图标按钮）必须自带 aria-label。
// 只看「开标签 → svg」这一段，避免把含文字的按钮误判成图标按钮。
const iconOnlyRe = /<(?:Link|button|a)\b([^>]*?)>\s*<svg\b/g;
const missingLabel: string[] = [];
for (const file of [...walkTsx("components"), ...walkTsx("app")]) {
  const src = read(file);
  for (const m of src.matchAll(iconOnlyRe)) {
    if (!/aria-label/.test(m[1])) missingLabel.push(file);
  }
}
missingLabel.length === 0
  ? ok(`纯图标交互元素全部带 aria-label（扫描 ${walkTsx("components").length + walkTsx("app").length} 个 tsx）`)
  : no(`纯图标交互元素缺 aria-label：${[...new Set(missingLabel)].join(", ")}`);

console.log("\nB. 折叠组件状态语义");
has("折叠按钮有 aria-expanded={open}", "components/CollapsibleBlock.tsx", "aria-expanded={open}");
has("折叠渐隐层标了 aria-hidden", "components/CollapsibleBlock.tsx", "aria-hidden");

console.log("\nC. 44px 命中区契约（视觉盒不变）");
has("章节胶囊挂了 tap-44-y", "components/ResultSectionNav.tsx", 'className="tap-44-y"');
has("搜索图标挂了 tap-44", "components/ResultSectionNav.tsx", 'className="tap-44 ');
has("折叠按钮挂了 tap-44-y", "components/CollapsibleBlock.tsx", 'className="tap-44-y"');
has("globals.css 定义 .tap-44-y::after", "app/globals.css", ".tap-44-y::after");
has("globals.css 定义 .tap-44::after", "app/globals.css", ".tap-44::after");
has("命中区尺寸取自 --cx-tap-min 而非写死", "app/globals.css", "height: var(--cx-tap-min)");
has("滚动容器自带 py-2（否则伪元素被 overflow 裁掉）", "components/ResultSectionNav.tsx", "overflow-x-auto scrollbar-none py-2");

console.log("\nD. 减少动态效果");
has("CSS 侧有 @media (prefers-reduced-motion: reduce)", "app/globals.css", "@media (prefers-reduced-motion: reduce)");
has("CSS 侧用 0.01ms 而非 animation:none（否则 stagger 内容永远隐形）", "app/globals.css", "animation-duration: 0.01ms");
has("JS 侧 scrollIntoView 尊重偏好", "components/ResultSectionNav.tsx", "prefers-reduced-motion: reduce");
has("framer-motion 侧 MotionConfig reducedMotion=user", "components/MotionProvider.tsx", 'reducedMotion="user"');
has("layout 接了 MotionProvider", "app/layout.tsx", "<MotionProvider>");

console.log("\nE. 设计令牌接线");
has("tokens.css 存在", "app/tokens.css", "--cx-cream");
has("layout 引入 tokens.css", "app/layout.tsx", 'import "./tokens.css"');
{
  const layout = exists("app/layout.tsx") ? read("app/layout.tsx") : "";
  const iTokens = layout.indexOf('import "./tokens.css"');
  const iGlobals = layout.indexOf('import "./globals.css"');
  iTokens >= 0 && iGlobals > iTokens
    ? ok("tokens.css 在 globals.css 之前引入")
    : no("tokens.css 必须在 globals.css 之前引入");
}
{
  const files = ["app/globals.css", "components/ResultSectionNav.tsx", "components/CollapsibleBlock.tsx"];
  const n = files.reduce((sum, f) => sum + (exists(f) ? (read(f).match(/var\(--cx-/g) || []).length : 0), 0);
  n >= 8 ? ok(`令牌被真实引用 ${n} 处（不是空壳文件）`) : no(`令牌引用仅 ${n} 处，疑似空壳`);
}

console.log(`\n══════ 结果：${pass} 通过 / ${fail} 失败 ══════`);
process.exit(fail > 0 ? 1 : 0);
