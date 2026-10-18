/**
 * gen-perfume-semantics.ts
 *
 * P2 离线语义层的「生成期」脚本：
 *   香调词词典（lib/data/noteSemantics.ts）+ 香水库 → 逐支香水的语义向量
 *   → 产出静态数据文件 lib/data/perfumeSemantics.ts
 *
 * 这个脚本只在「词典或香水库变了」的时候手动跑一次，产物进版本库。
 * 运行时只读产物、不跑本脚本、不调任何外部服务。
 *
 * 用法：npx tsx scripts/gen-perfume-semantics.ts
 */

import * as fs from "fs";
import * as path from "path";
import { PERFUMES, type Perfume } from "@/lib/data";
import {
  noteSemantics,
  ACTIVE_TEXTURES,
  type Texture,
} from "@/lib/data/noteSemantics";

/** 三段香调对「性格」的贡献权重：前调最响，后调多为定香剂（如麝香）性格弱 */
const PHASE_W: Record<"top" | "heart" | "base", number> = {
  top: 1.2,
  heart: 1.0,
  base: 0.8,
};

export interface PerfumeSemantics {
  /** 体感冷暖 -1(冷) … +1(暖) */
  temp: number;
  /** 质感分布（已归一化，和为 1；全为中性填充时为空对象） */
  texture: Partial<Record<Texture, number>>;
  /** 昼夜倾向（由冷暖 + 扩散 + 留香推导） */
  dayNight: "day" | "night" | "any";
}

export function buildSemantics(perfume: Perfume): PerfumeSemantics {
  const phases: Array<["top" | "heart" | "base", string[]]> = [
    ["top", perfume.notes.top],
    ["heart", perfume.notes.heart],
    ["base", perfume.notes.base],
  ];

  let tempSum = 0;
  let weightSum = 0;
  const tex: Partial<Record<Texture, number>> = {};
  let texTotal = 0;

  for (const [phase, notes] of phases) {
    for (const raw of notes) {
      const n = raw.trim();
      if (!n) continue;
      const s = noteSemantics(n);
      const w = PHASE_W[phase];
      tempSum += s.temp * w;
      weightSum += w;
      if (s.texture !== "none") {
        tex[s.texture] = (tex[s.texture] ?? 0) + w;
        texTotal += w;
      }
    }
  }

  const temp = weightSum > 0 ? tempSum / weightSum : 0;

  // 归一化质感分布（保留 4 位小数，避免生成文件里出现长浮点噪音）
  const norm: Partial<Record<Texture, number>> = {};
  if (texTotal > 0) {
    for (const t of ACTIVE_TEXTURES) {
      const v = tex[t];
      if (v && v > 0) norm[t] = Math.round((v / texTotal) * 10000) / 10000;
    }
    // 浮点归一化后可能不是精确的 1，把误差补回最大的一项，保证和为 1
    const sum = Object.values(norm).reduce((a, b) => a + (b ?? 0), 0);
    if (sum > 0 && Math.abs(sum - 1) > 1e-9) {
      const [biggest] = Object.entries(norm).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
      norm[biggest as Texture] = Math.round(((norm[biggest as Texture] ?? 0) + (1 - sum)) * 10000) / 10000;
    }
  }

  // 昼夜：暖 + 重 → 夜；冷 + 轻 → 昼；其余皆可
  const heavy = perfume.intensity >= 4 || perfume.longevity >= 4;
  const light = perfume.intensity <= 2 && perfume.longevity <= 3;
  let dayNight: "day" | "night" | "any" = "any";
  if (temp > 0.15 && heavy) dayNight = "night";
  else if (temp < -0.15 && light) dayNight = "day";

  return {
    temp: Math.round(temp * 10000) / 10000,
    texture: norm,
    dayNight,
  };
}

function main() {
  const entries: string[] = [];
  const ids = Object.keys(PERFUMES).sort();
  for (const id of ids) {
    const p = PERFUMES[id];
    const s = buildSemantics(p);
    const tex = Object.entries(s.texture)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    entries.push(`  "${id}": { temp: ${s.temp}, texture: { ${tex} }, dayNight: "${s.dayNight}" },`);
  }

  const out = `// ============================================================
// ⚠️ 本文件由 scripts/gen-perfume-semantics.ts 自动生成，请勿手改。
//    改词典请改 lib/data/noteSemantics.ts，然后重跑生成脚本。
//
// P2 离线语义层产物：225 支香水各自的
//   temp      体感冷暖 -1(冷) … +1(暖)
//   texture   质感分布（和为 1，键取自 ACTIVE_TEXTURES）
//   dayNight  昼夜倾向
//
// 运行时只读本表，零 LLM 调用、零延迟、完全可复现。
// 覆盖度与取值合法性由 scripts/audit-perfume-semantics.ts 门禁守着。
// ============================================================

import type { Texture } from "./noteSemantics";

export interface PerfumeSemantics {
  temp: number;
  texture: Partial<Record<Texture, number>>;
  dayNight: "day" | "night" | "any";
}

export const PERFUME_SEMANTICS: Record<string, PerfumeSemantics> = {
${entries.join("\n")}
};

/** 取某支香的语义（未命中返回 null，调用方须自行兜底，不要抛错） */
export function getPerfumeSemantics(id: string): PerfumeSemantics | null {
  return PERFUME_SEMANTICS[id] ?? null;
}
`;

  const target = path.join(process.cwd(), "lib", "data", "perfumeSemantics.ts");
  fs.writeFileSync(target, out, "utf8");
  console.log(`已生成 ${ids.length} 条语义 → ${target}`);
}

main();
