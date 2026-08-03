// ============================================================
// Crush香鉴 — 批量导入生成器
// 运行: npm run import:perfumes
// 输入: scripts/perfumes.csv  (列: id,name,brand,brandCn,top,heart,base,intensity,longevity,tier,priceRange,description)
//       top/heart/base 用分号 ; 分隔多个香料
// 输出: lib/perfumes.extra.ts  (data.ts 自动合并进 PERFUMES)
// 说明: 导入时校验字段，并用 getPerfumeProfile 预警零/弱向量香水。
// ============================================================

import { writeFileSync, readFileSync } from "node:fs";
import { PERFUMES_BASE } from "../lib/data";
import { getPerfumeProfile } from "../lib/matchPerfumes";

const CSV_PATH = "scripts/perfumes.csv";
const OUT_PATH = "lib/perfumes.extra.ts";
const TIERS = new Set(["signature", "advanced", "budget"]);

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

const csv = parseCSV(readFileSync(CSV_PATH, "utf8").toString());
const header = csv[0];
const dataRows = csv.slice(1).filter((r) => r.length >= 12 && r[0] && r[0] !== "id" && !r[0].startsWith("#"));

const errors: string[] = [];
const warnings: string[] = [];
const entries: string[] = [];
const seen = new Set<string>();

for (const r of dataRows) {
  const [
    id, name, brand, brandCn, top, heart, base,
    intensity, longevity, tier, priceRange, description,
  ] = r;

  if (PERFUMES_BASE[id]) errors.push(`${id}: id 与 PERFUMES_BASE 冲突`);
  if (seen.has(id)) errors.push(`${id}: CSV 内重复 id`);
  seen.add(id);

  const intensityN = Number(intensity);
  const longevityN = Number(longevity);
  if (!Number.isInteger(intensityN) || intensityN < 1 || intensityN > 5)
    errors.push(`${id}: intensity 须为 1-5`);
  if (!Number.isInteger(longevityN) || longevityN < 1 || longevityN > 5)
    errors.push(`${id}: longevity 须为 1-5`);
  if (!TIERS.has(tier)) errors.push(`${id}: tier 须为 signature/advanced/budget`);
  if (!top || !heart || !base) errors.push(`${id}: notes 不能为空`);

  const notes = {
    top: top.split(";").map((s) => s.trim()).filter(Boolean),
    heart: heart.split(";").map((s) => s.trim()).filter(Boolean),
    base: base.split(";").map((s) => s.trim()).filter(Boolean),
  };

  // 零/弱向量预警（仅当字段合法时计算）
  if (!errors.some((e) => e.startsWith(id))) {
    const perfume = {
      id, name, brand, brandCn, notes,
      intensity: 1, longevity: 1, tier: "advanced" as const, priceRange: "", description: "",
    };
    const v = getPerfumeProfile(perfume);
    const hits = v.floral + v.woody + v.fresh + v.oriental + v.citrus + v.gourmand;
    if (hits === 0) warnings.push(`${id}: 零向量！notes 未被关键词覆盖，重排会被沉底`);
    else if (hits <= 1) warnings.push(`${id}: 弱向量（仅命中 ${hits} 个关键词）`);
  }

  if (errors.some((e) => e.startsWith(id))) continue;

  entries.push(
`  ${JSON.stringify(id)}: {
    id: ${JSON.stringify(id)},
    name: ${JSON.stringify(name)},
    brand: ${JSON.stringify(brand)},
    brandCn: ${JSON.stringify(brandCn)},
    notes: {
      top: ${JSON.stringify(notes.top)},
      heart: ${JSON.stringify(notes.heart)},
      base: ${JSON.stringify(notes.base)},
    },
    intensity: ${intensityN},
    longevity: ${longevityN},
    tier: ${JSON.stringify(tier)},
    priceRange: ${JSON.stringify(priceRange)},
    description: ${JSON.stringify(description)},
  },`);
}

if (errors.length) {
  console.error("❌ 导入失败，以下错误需修正:\n  " + errors.join("\n  "));
  process.exit(1);
}

const out =
`// 自动生成，勿手改。来源: scripts/perfumes.csv
// 重新生成: npm run import:perfumes
import type { Perfume } from "./data";

export const PERFUMES_EXTRA: Record<string, Perfume> = {
${entries.join("\n")}
};
`;

writeFileSync(OUT_PATH, out, "utf8");
console.log(`✅ 已生成 ${OUT_PATH}：${entries.length} 支香水`);
if (warnings.length) console.log("⚠️ 预警:\n  " + warnings.join("\n  "));
console.log(`\n当前香水库: ${Object.keys(PERFUMES_BASE).length} (base) + ${entries.length} (extra) = ${Object.keys(PERFUMES_BASE).length + entries.length}`);
